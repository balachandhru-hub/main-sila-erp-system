using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CancelSilaPhysicalInventory
{
    /// <summary>Cancels a physical inventory that has not started. A started one is closed by cancelling its count.</summary>
    public class CancelSilaPhysicalInventoryCommandHandler : IRequestHandler<CancelSilaPhysicalInventoryCommand, Unit>
    {
        private const int MAX_REASON_LENGTH = 500;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CancelSilaPhysicalInventoryCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(CancelSilaPhysicalInventoryCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Cancelling physical inventory. RequestId: {request.RequestId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            string? reason = string.IsNullOrWhiteSpace(request.Request.Reason) ? null : request.Request.Reason.Trim();
            if (reason != null && reason.Length > MAX_REASON_LENGTH)
            {
                _logger.LogError($"Cancellation reason too long. Length: {reason.Length}");
                throw new BadRequestCustomException("Reason is too long.", $"Keep the reason within {MAX_REASON_LENGTH} characters.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PhysicalInventoryRequest physicalInventory = await SilaPhysicalInventoryRules.GetAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.RequestId, cancellationToken);
            SilaPhysicalInventoryRules.EnsureScheduled(_logger, physicalInventory);

            physicalInventory.Status = Common.SILA_PI_CANCELLED;
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_PHYSICAL_INVENTORY, physicalInventory.Id, SilaPhysicalInventoryRules.EVENT_CANCELLED, reason);
            await _repository.SaveAsync();

            _logger.LogInfo($"Physical inventory cancelled. RequestId: {physicalInventory.Id}");
            return Unit.Value;
        }
    }
}
