using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaPhysicalInventory
{
    /// <summary>
    /// Schedules a physical inventory (surprise blind count) at a location and emails the cost controllers and buyer
    /// administrators. A request scheduled for today opens its count at once.
    /// </summary>
    public class CreateSilaPhysicalInventoryCommandHandler : IRequestHandler<CreateSilaPhysicalInventoryCommand, SilaPhysicalInventoryDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;
        private readonly IMetadataApiClient _metadataApiClient;

        public CreateSilaPhysicalInventoryCommandHandler(
            IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient, IMetadataApiClient metadataApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
            _metadataApiClient = metadataApiClient;
        }

        public Task<SilaPhysicalInventoryDto> Handle(CreateSilaPhysicalInventoryCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(CreateSilaPhysicalInventoryCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<SilaPhysicalInventoryDto> HandleOnceAsync(CreateSilaPhysicalInventoryCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo(
                $"Requesting physical inventory. LocationId: {request.Request.LocationId}, ScheduledDate: {request.Request.ScheduledDate:yyyy-MM-dd}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            string reason = SilaPhysicalInventoryRules.ValidateReason(_logger, request.Request.Reason);
            DateTime scheduledDate = SilaPhysicalInventoryRules.ResolveDate(_logger, request.Request.ScheduledDate);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.Request.LocationId);
            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, location.Id, cancellationToken);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            Guid? assignedUserId = request.Request.AssignedUserId == Guid.Empty ? null : request.Request.AssignedUserId;
            if (assignedUserId != null)
            {
                List<IdentityUserDto> organizationUsers = await _identityApiClient.GetOrganizationUsers(request.OrganizationId, cancellationToken);
                if (!organizationUsers.Any(x => x.UserId == assignedUserId.Value))
                {
                    _logger.LogError($"Assigned user not found in organization. AssignedUserId: {assignedUserId}, OrganizationId: {request.OrganizationId}");
                    throw new NotFoundCustomException("User not found.", "Assign the physical inventory to a user of this organization, or leave it unassigned.");
                }
            }
            PhysicalInventoryRequest physicalInventory = await SilaPhysicalInventoryRules.CreateAsync(
                _repository, _logger, ledger, buyer.Id, request.UserId, location, null, reason, scheduledDate, assignedUserId, cancellationToken);
            if (scheduledDate == DateTime.UtcNow.Date)
            {
                await SilaPhysicalInventoryRules.StartCountAsync(_repository, _logger, ledger, physicalInventory, cancellationToken);
            }

            await _repository.SaveAsync();
            await SilaPhysicalInventoryNotifier.NotifyAsync(
                _identityApiClient, _metadataApiClient, _logger, request.OrganizationId, physicalInventory, location.LocationName, cancellationToken);

            List<SilaPhysicalInventoryDto> mapped = await SilaPhysicalInventoryRules.MapAsync(
                _repository, buyer.Id, new List<PhysicalInventoryRequest> { physicalInventory }, cancellationToken);
            _logger.LogInfo($"Physical inventory requested. RequestId: {physicalInventory.Id}, Number: {physicalInventory.RequestNumber}, Status: {physicalInventory.Status}");
            return mapped[0];
        }
    }
}
