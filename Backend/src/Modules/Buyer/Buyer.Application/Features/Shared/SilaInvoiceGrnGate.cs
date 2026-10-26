using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// When a goods receipt later posts to SAP, drop the invoice's stale "GRN was not posted" block.
    /// Does not send the invoice or change SAP posting mappers.
    /// </summary>
    public static class SilaInvoiceGrnGate
    {
        public static bool IsGoodsReceiptNotPostedMessage(string? message)
        {
            return !string.IsNullOrWhiteSpace(message)
                && message.Contains("was not posted to the ERP", StringComparison.OrdinalIgnoreCase)
                && message.Contains("Reprocess the goods receipt first", StringComparison.OrdinalIgnoreCase);
        }

        public static async Task<bool> AllGoodsReceiptsPostedAsync(
            IRepositoryWrapper repository, Invoice invoice, CancellationToken cancellationToken)
        {
            List<GoodsReceipt> receipts = await repository.GoodsReceipt
                .FindByCondition(x => x.BuyerId == invoice.BuyerId && x.InvoiceId == invoice.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            if (receipts.Count == 0)
            {
                return false;
            }

            List<Guid> postingIds = receipts.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            Dictionary<Guid, InventoryErpPosting> postings = postingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await repository.InventoryErpPosting.FindByCondition(x => postingIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);
            return receipts.All(receipt =>
            {
                if (receipt.ErpPostingId == null)
                {
                    return !string.IsNullOrWhiteSpace(receipt.MaterialDocument);
                }

                if (!postings.TryGetValue(receipt.ErpPostingId.Value, out InventoryErpPosting? posting))
                {
                    return !string.IsNullOrWhiteSpace(receipt.MaterialDocument);
                }

                return posting.Status is Common.SILA_POSTING_POSTED or Common.SILA_POSTING_ERP_ACCEPTED or Common.SILA_POSTING_FAILED_LOCAL
                    || !string.IsNullOrWhiteSpace(posting.ErpReference)
                    || !string.IsNullOrWhiteSpace(receipt.MaterialDocument);
            });
        }

        public static async Task ReleaseBlockedInvoiceAsync(
            IRepositoryWrapper repository, Invoice invoice, CancellationToken cancellationToken)
        {
            if (!await AllGoodsReceiptsPostedAsync(repository, invoice, cancellationToken))
            {
                return;
            }

            if (invoice.ErpPostingId == null)
            {
                return;
            }

            InventoryErpPosting? posting = await repository.InventoryErpPosting
                .FindFirstByConditionAsync(x => x.Id == invoice.ErpPostingId && x.BuyerId == invoice.BuyerId);
            if (posting == null || !IsGoodsReceiptNotPostedMessage(posting.ErrorMessage))
            {
                return;
            }

            posting.ErrorMessage = null;
            if (string.IsNullOrWhiteSpace(posting.ErpReference)
                && posting.Status is Common.SILA_POSTING_FAILED or Common.SILA_POSTING_SKIPPED)
            {
                posting.IsActive = false;
                invoice.ErpPostingId = null;
                repository.Invoice.Update(invoice);
            }

            repository.InventoryErpPosting.Update(posting);
            await SilaInvoicePosting.ClearStaleBlocksAsync(repository, invoice.Id, cancellationToken);
        }
    }
}
