using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.RescheduleSilaPhysicalInventory
{
    /// <summary>Moves a scheduled physical inventory to another day (or a new random working day) and emails the new date.</summary>
    public class RescheduleSilaPhysicalInventoryCommandHandler : IRequestHandler<RescheduleSilaPhysicalInventoryCommand, SilaPhysicalInventoryDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;
        private readonly IMetadataApiClient _metadataApiClient;

        public RescheduleSilaPhysicalInventoryCommandHandler(
            IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient, IMetadataApiClient metadataApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
            _metadataApiClient = metadataApiClient;
        }

        public Task<SilaPhysicalInventoryDto> Handle(RescheduleSilaPhysicalInventoryCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(RescheduleSilaPhysicalInventoryCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<SilaPhysicalInventoryDto> HandleOnceAsync(RescheduleSilaPhysicalInventoryCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo(
                $"Rescheduling physical inventory. RequestId: {request.RequestId}, ScheduledDate: {request.Request.ScheduledDate:yyyy-MM-dd}, UserId: {request.UserId}");

            DateTime scheduledDate = SilaPhysicalInventoryRules.ResolveDate(_logger, request.Request.ScheduledDate);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PhysicalInventoryRequest physicalInventory = await SilaPhysicalInventoryRules.GetAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.RequestId, cancellationToken);
            SilaPhysicalInventoryRules.EnsureScheduled(_logger, physicalInventory);

            DateTime previous = physicalInventory.ScheduledDate;
            physicalInventory.ScheduledDate = scheduledDate;
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_PHYSICAL_INVENTORY, physicalInventory.Id, SilaPhysicalInventoryRules.EVENT_RESCHEDULED,
                $"{previous:yyyy-MM-dd} -> {scheduledDate:yyyy-MM-dd}");
            if (scheduledDate == DateTime.UtcNow.Date)
            {
                await SilaPhysicalInventoryRules.StartCountAsync(_repository, _logger, ledger, physicalInventory, cancellationToken);
            }

            await _repository.SaveAsync();

            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, physicalInventory.LocationId);
            await SilaPhysicalInventoryNotifier.NotifyAsync(
                _identityApiClient, _metadataApiClient, _logger, request.OrganizationId, physicalInventory, location.LocationName, cancellationToken);

            List<SilaPhysicalInventoryDto> mapped = await SilaPhysicalInventoryRules.MapAsync(
                _repository, buyer.Id, new List<PhysicalInventoryRequest> { physicalInventory }, cancellationToken);
            _logger.LogInfo($"Physical inventory rescheduled. RequestId: {physicalInventory.Id}, ScheduledDate: {scheduledDate:yyyy-MM-dd}, Status: {physicalInventory.Status}");
            return mapped[0];
        }
    }
}
