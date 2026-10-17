using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Completes a posting whose ERP document is already known. It never sends the document again.
    /// </summary>
    public static class SilaPostingRecovery
    {
        public static async Task<string> FinalizeLocalAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            InventoryErpPosting posting,
            Guid userId,
            string? previousError,
            CancellationToken cancellationToken,
            string? basePath = null)
        {
            if (posting.Status == Common.SILA_POSTING_POSTED)
            {
                return posting.Status;
            }

            if (!SilaTrackerRules.ErpAlreadyAccepted(posting))
            {
                return posting.Status;
            }

            try
            {
                if (posting.ReferenceType == Common.SILA_REF_POS_SALE)
                {
                    await MarkPosPostedAsync(repository, posting, cancellationToken);
                }

                posting.Status = Common.SILA_POSTING_POSTED;
                posting.ErrorMessage = null;
                posting.PostedOn ??= DateTime.UtcNow;
                await SilaInvoicePosting.OnFinishedAsync(repository, logger, basePath, posting, posting.Status, cancellationToken);
                Record(repository, posting, userId, SilaTrackerRules.FROM_LOCAL, previousError, false, true, "Local finalization completed. SAP was not called.");
                await repository.SaveAsync();
                logger.LogInfo($"ERP posting finalized locally. PostingId: {posting.Id}, Reference: {posting.ErpReference}");
                return posting.Status;
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError($"Local finalization failed. PostingId: {posting.Id}, Error: {SilaLogText.Short(exception.Message)}");
                posting.Status = Common.SILA_POSTING_FAILED_LOCAL;
                posting.ErrorMessage = SilaTrackerRules.LocalFailureMessage(posting.ErpReference);
                await SilaInvoicePosting.OnFinishedAsync(repository, logger, basePath, posting, posting.Status, cancellationToken);
                Record(repository, posting, userId, SilaTrackerRules.FROM_LOCAL, previousError, false, true, posting.ErrorMessage);
                try
                {
                    await repository.SaveAsync();
                }
                catch (Exception saveException) when (saveException is not OperationCanceledException)
                {
                    logger.LogError($"Local failure could not be saved. PostingId: {posting.Id}, Error: {SilaLogText.Short(saveException.Message)}");
                }

                return posting.Status;
            }
        }

        public static void Record(
            IRepositoryWrapper repository,
            InventoryErpPosting posting,
            Guid userId,
            string stage,
            string? previousError,
            bool erpCalled,
            bool localCalled,
            string result)
        {
            string comment = $"Stage={stage}; ErpCalled={(erpCalled ? "Yes" : "No")}; LocalCalled={(localCalled ? "Yes" : "No")}; Attempt={posting.Attempts}; Previous={Trim(previousError)}; Result={Trim(result)}";
            repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = posting.BuyerId,
                ReferenceType = posting.ReferenceType,
                ReferenceId = posting.ReferenceId,
                Action = SilaTrackerRules.EVENT_REPROCESS,
                Comment = comment.Length > 1000 ? comment[..1000] : comment,
                ActorUserId = userId,
                IsActive = true
            });
        }

        private static async Task MarkPosPostedAsync(IRepositoryWrapper repository, InventoryErpPosting posting, CancellationToken cancellationToken)
        {
            List<PosSalesTransaction> sales = await repository.PosSalesTransaction
                .FindByCondition(x => x.BuyerId == posting.BuyerId && x.IsActive && (x.ErpPostingId == posting.Id || x.Id == posting.ReferenceId))
                .ToListAsync(cancellationToken);
            foreach (PosSalesTransaction sale in sales)
            {
                sale.Status = Common.SILA_POS_POSTED;
                sale.FailedStep = null;
                sale.FailureMessage = null;
                repository.PosSalesTransaction.Update(sale);
            }
        }

        private static string Trim(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            string text = value.Trim().Replace('\r', ' ').Replace('\n', ' ');
            return text.Length > 240 ? text[..240] : text;
        }
    }
}
