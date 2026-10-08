using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DisputeSilaTransfer
{
    /// <summary>
    /// The source location disputes an already-collected quick transfer (the stock was not taken as recorded). No stock
    /// moves; the transfer goes to DISCREPANCY with the reason and a TRANSFER_DISCREPANCY alert is raised for review.
    /// </summary>
    public class DisputeSilaTransferCommandHandler : IRequestHandler<DisputeSilaTransferCommand, Unit>
    {
        private const int MAX_REASON = 1000;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DisputeSilaTransferCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DisputeSilaTransferCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Disputing transfer handover. TransferId: {request.TransferId}, UserId: {request.UserId}");

            string reason = request.Request.Comment?.Trim() ?? string.Empty;
            if (reason.Length == 0 || reason.Length > MAX_REASON)
            {
                _logger.LogError($"Dispute reason missing or too long. TransferId: {request.TransferId}");
                throw new BadRequestCustomException("A dispute reason is required.", $"Enter why the handover is disputed (at most {MAX_REASON} characters).");
            }

            SilaTransferRules.ValidateComment(_logger, request.Request.Comment);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InternalTransferOrder transfer = await SilaTransferRules.GetTransferAsync(_repository, _logger, buyer.Id, request.TransferId);
            if (!transfer.AlreadyCollected)
            {
                _logger.LogError($"Dispute of a transfer that was not collected. TransferId: {transfer.Id}");
                throw new BadRequestCustomException("The transfer was not recorded as already collected.", "Reject or receive the transfer instead.");
            }

            SilaTransferRules.EnsureStatus(_logger, transfer, "disputed", Common.SILA_ITO_APPROVED);
            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, transfer.FromLocationId, cancellationToken);

            List<InternalTransferOrderItem> items = await SilaTransferRules.GetItemsAsync(_repository, transfer.Id, cancellationToken);
            transfer.Status = Common.SILA_ITO_DISCREPANCY;
            transfer.DisputeReason = reason;
            transfer.Comment = reason;

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            await ledger.RaiseAlertAsync(new InventoryAlert
            {
                AlertType = Common.SILA_ALERT_TRANSFER_DISCREPANCY,
                Severity = Common.SILA_SEVERITY_HIGH,
                Title = $"Disputed collection: {transfer.ItoNumber}",
                Message = $"The source disputes the stock recorded as already collected: {reason}",
                LocationId = transfer.ToLocationId,
                MaterialId = items.Count == 1 ? items[0].MaterialId : null,
                ReferenceType = Common.SILA_REF_ITO,
                ReferenceId = transfer.Id,
                RecommendedAction = Common.SILA_ACTION_REVIEW_TRANSFER
            }, cancellationToken);
            ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, SilaTransferRules.ACTION_DISPUTE, reason);
            await _repository.SaveAsync();

            _logger.LogInfo($"Transfer handover disputed. TransferId: {transfer.Id}");
            return Unit.Value;
        }
    }
}
