using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReprocessSilaPosTransaction
{
    /// <summary>
    /// Re-runs a failed POS sale from the failed step. A failed ERP posting is put back to PENDING for the
    /// InventoryErpPostingJob; stock is never deducted twice.
    /// </summary>
    public class ReprocessSilaPosTransactionCommandHandler : IRequestHandler<ReprocessSilaPosTransactionCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ReprocessSilaPosTransactionCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Unit> Handle(ReprocessSilaPosTransactionCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunForJobAsync(_repository, _logger, nameof(ReprocessSilaPosTransactionCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Unit> HandleOnceAsync(ReprocessSilaPosTransactionCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Reprocessing POS transaction. TransactionId: {request.TransactionId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSalesTransaction? transaction = await _repository.PosSalesTransaction.FindFirstByConditionAsync(
                x => x.Id == request.TransactionId && x.BuyerId == buyer.Id && x.IsActive);
            if (transaction == null)
            {
                _logger.LogError($"POS transaction not found. TransactionId: {request.TransactionId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Transaction not found.", "Select a POS transaction of this organization.");
            }

            if (!SilaAccess.HasFullAccess(request.RoleId) && transaction.OutletLocationId != null)
            {
                await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, transaction.OutletLocationId.Value, cancellationToken);
            }

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);

            if (transaction.Status == Common.SILA_POS_POSTED)
            {
                _logger.LogError($"POS transaction is already posted. TransactionId: {transaction.Id}");
                throw new BadRequestCustomException("Nothing to reprocess.", "A posted sale is not reprocessed.");
            }

            bool stockPosted = await ledger.HasReferenceAsync(Common.SILA_REF_POS_SALE, transaction.Id, cancellationToken);
            if (transaction.ErpPostingId != null && (stockPosted || transaction.Status == Common.SILA_POS_INVENTORY_DEDUCTED || transaction.FailedStep == Common.SILA_POS_STEP_POST))
            {
                Guid postingId = transaction.ErpPostingId.Value;
                InventoryErpPosting? posting = await _repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == postingId && x.BuyerId == buyer.Id);
                if (posting == null || posting.Status == Common.SILA_POSTING_POSTED || posting.Status == Common.SILA_POSTING_PENDING)
                {
                    _logger.LogError($"POS transaction posting cannot be sent again. TransactionId: {transaction.Id}, PostingStatus: {posting?.Status}");
                    throw new BadRequestCustomException("Nothing to reprocess.", "A posted or in-flight ERP posting is not sent again. Reprocess only a failed posting.");
                }

                if (posting.Status == Common.SILA_POSTING_UNKNOWN)
                {
                    throw new BadRequestCustomException("Reconcile this posting.", "SAP did not confirm the consumption document. Reconcile it before anything is sent again.");
                }

                if (SilaTrackerRules.ErpAlreadyAccepted(posting))
                {
                    await SilaPostingRecovery.FinalizeLocalAsync(_repository, _logger, posting, request.UserId, posting.ErrorMessage, cancellationToken);
                    _logger.LogInfo($"POS transaction finalized locally. TransactionId: {transaction.Id}, PostingId: {posting.Id}");
                    return Unit.Value;
                }

                string? originalError = posting.ErrorMessage;
                posting.Status = Common.SILA_POSTING_PENDING;
                posting.ErrorMessage = null;
                SilaPostingRecovery.Record(_repository, posting, request.UserId, SilaTrackerRules.FROM_ERP, originalError, true, false, "ERP processing queued again. Inventory is not deducted again.");
                await _repository.SaveAsync();
                _logger.LogInfo($"POS transaction ERP posting queued again. TransactionId: {transaction.Id}, PostingId: {posting.Id}");
                return Unit.Value;
            }

            bool needsPosting = transaction.Status == Common.SILA_POS_INVENTORY_DEDUCTED && transaction.ErpPostingId == null;
            if (transaction.Status != Common.SILA_POS_FAILED && transaction.Status != Common.SILA_POS_RECEIVED && !needsPosting)
            {
                _logger.LogError($"POS transaction is not failed. TransactionId: {transaction.Id}, Status: {transaction.Status}");
                throw new BadRequestCustomException("Nothing to reprocess.", "Only a failed sale, or one whose inventory was not updated, can be reprocessed.");
            }

            ledger.AddEvent(Common.SILA_REF_POS_SALE, transaction.Id, SilaPosProcessing.EVENT_REPROCESS, $"Reprocess from step {transaction.FailedStep ?? Common.SILA_POS_STEP_MATCH}.");
            int failed = await SilaPosProcessing.ProcessAsync(
                _repository, _logger, buyer.Id, request.UserId, new List<PosSalesTransaction> { transaction }, cancellationToken);
            await _repository.SaveAsync();

            _logger.LogInfo($"POS transaction reprocessed. TransactionId: {transaction.Id}, Status: {transaction.Status}, Failed: {failed}");
            return Unit.Value;
        }
    }
}
