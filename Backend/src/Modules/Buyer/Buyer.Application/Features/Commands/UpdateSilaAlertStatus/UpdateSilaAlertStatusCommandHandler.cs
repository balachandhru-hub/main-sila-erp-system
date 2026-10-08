using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UpdateSilaAlertStatus
{
    public class UpdateSilaAlertStatusCommandHandler : IRequestHandler<UpdateSilaAlertStatusCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public UpdateSilaAlertStatusCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(UpdateSilaAlertStatusCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Changing alert status. AlertId: {request.AlertId}, Status: {request.Status}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryAlert alert = await SilaAlertRules.GetAlertAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.AlertId, cancellationToken);

            bool allowed = request.Status == Common.SILA_ALERT_ACKNOWLEDGED
                ? alert.Status == Common.SILA_ALERT_NEW
                : (request.Status == Common.SILA_ALERT_RESOLVED || request.Status == Common.SILA_ALERT_DISMISSED) && SilaAlertRules.IsOpen(alert);
            if (!allowed)
            {
                _logger.LogError($"Alert status change not allowed. AlertId: {alert.Id}, From: {alert.Status}, To: {request.Status}");
                throw new BadRequestCustomException("Alert cannot be changed.", $"The alert is {alert.Status} and cannot be marked {request.Status}.");
            }

            alert.Status = request.Status;
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(SilaAlertRules.REF_ALERT, alert.Id, request.Status, alert.Title);
            await _repository.SaveAsync();

            _logger.LogInfo($"Alert status changed. AlertId: {alert.Id}, Status: {alert.Status}");
            return Unit.Value;
        }
    }
}
