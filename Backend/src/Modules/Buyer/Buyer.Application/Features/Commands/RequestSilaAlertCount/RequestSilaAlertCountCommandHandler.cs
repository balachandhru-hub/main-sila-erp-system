using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.RequestSilaAlertCount
{
    /// <summary>
    /// Turns an alert (negative stock, count variance...) into a physical inventory request: a surprise blind count on a
    /// random working day within the next 7 days, emailed to the cost controllers and buyer administrators.
    /// </summary>
    public class RequestSilaAlertCountCommandHandler : IRequestHandler<RequestSilaAlertCountCommand, SilaPhysicalInventoryDto>
    {
        private const string EVENT_PHYSICAL_INVENTORY_REQUESTED = "PHYSICAL_INVENTORY_REQUESTED";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;
        private readonly IMetadataApiClient _metadataApiClient;

        public RequestSilaAlertCountCommandHandler(
            IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient, IMetadataApiClient metadataApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
            _metadataApiClient = metadataApiClient;
        }

        public Task<SilaPhysicalInventoryDto> Handle(RequestSilaAlertCountCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(RequestSilaAlertCountCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<SilaPhysicalInventoryDto> HandleOnceAsync(RequestSilaAlertCountCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Requesting physical inventory from an alert. AlertId: {request.AlertId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            DateTime scheduledDate = SilaPhysicalInventoryRules.ResolveDate(_logger, request.ScheduledDate);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryAlert alert = await SilaAlertRules.GetAlertAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.AlertId, cancellationToken);
            if (!SilaAlertRules.IsOpen(alert))
            {
                _logger.LogError($"Alert is closed. AlertId: {alert.Id}, Status: {alert.Status}");
                throw new BadRequestCustomException("Alert is closed.", $"The alert is {alert.Status}. Request a physical inventory from the Physical Inventory screen instead.");
            }

            if (alert.LocationId == null)
            {
                _logger.LogError($"Alert has no location. AlertId: {alert.Id}");
                throw new BadRequestCustomException("Alert has no location.", "Request a physical inventory from the Physical Inventory screen and choose the location.");
            }

            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, alert.LocationId.Value);
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            string reason = alert.Title.Length > SilaPhysicalInventoryRules.MAX_REASON_LENGTH
                ? alert.Title.Substring(0, SilaPhysicalInventoryRules.MAX_REASON_LENGTH)
                : alert.Title;
            PhysicalInventoryRequest physicalInventory = await SilaPhysicalInventoryRules.CreateAsync(
                _repository, _logger, ledger, buyer.Id, request.UserId, location, alert.Id, reason, scheduledDate, null, cancellationToken);
            if (scheduledDate == DateTime.UtcNow.Date)
            {
                await SilaPhysicalInventoryRules.StartCountAsync(_repository, _logger, ledger, physicalInventory, cancellationToken);
            }

            alert.Status = Common.SILA_ALERT_ACKNOWLEDGED;
            ledger.AddEvent(SilaAlertRules.REF_ALERT, alert.Id, EVENT_PHYSICAL_INVENTORY_REQUESTED, $"{physicalInventory.RequestNumber} on {scheduledDate:yyyy-MM-dd}");
            await _repository.SaveAsync();
            await SilaPhysicalInventoryNotifier.NotifyAsync(
                _identityApiClient, _metadataApiClient, _logger, request.OrganizationId, physicalInventory, location.LocationName, cancellationToken);

            List<SilaPhysicalInventoryDto> mapped = await SilaPhysicalInventoryRules.MapAsync(
                _repository, buyer.Id, new List<PhysicalInventoryRequest> { physicalInventory }, cancellationToken);
            _logger.LogInfo($"Physical inventory requested from alert. AlertId: {alert.Id}, RequestId: {physicalInventory.Id}, ScheduledDate: {scheduledDate:yyyy-MM-dd}");
            return mapped[0];
        }
    }
}
