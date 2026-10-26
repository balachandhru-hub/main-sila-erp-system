using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Invoiceable quantity after confirmed GRN reversals. Counts only successful reversal qty.
    /// </summary>
    public static class SilaInvoiceableQuantity
    {
        public const string EXCEEDS_REVERSAL = "Invoice quantity exceeds the remaining received quantity after GRN reversal. Review the invoice quantity before posting.";

        private static readonly HashSet<string> ConfirmedReversal = new(StringComparer.OrdinalIgnoreCase)
        {
            Common.SILA_POSTING_POSTED,
            Common.SILA_POSTING_ERP_ACCEPTED,
            Common.SILA_POSTING_FAILED_LOCAL
        };

        public static decimal ConfirmedReversedQty(GoodsReceipt receipt, GoodsReceiptItem line)
        {
            if (line.ReversedQty <= 0)
            {
                return 0;
            }

            if (string.IsNullOrWhiteSpace(receipt.ReversalStatus)
                && string.IsNullOrWhiteSpace(receipt.ReversalMaterialDocument)
                && receipt.ReversalGoodsReceiptId == null)
            {
                return 0;
            }

            if (!string.IsNullOrWhiteSpace(receipt.ReversalStatus)
                && !ConfirmedReversal.Contains(receipt.ReversalStatus)
                && string.IsNullOrWhiteSpace(receipt.ReversalMaterialDocument))
            {
                return 0;
            }

            return line.ReversedQty;
        }

        public static async Task EnsureWithinRemainingAsync(
            IRepositoryWrapper repository,
            Invoice invoice,
            IReadOnlyCollection<InvoiceItem> items,
            CancellationToken cancellationToken)
        {
            if (SilaInvoiceCreation.IsNonPo(invoice.CreationType) || SilaReceivingRules.IsServiceInvoice(invoice))
            {
                return;
            }

            List<GoodsReceipt> receipts = await repository.GoodsReceipt
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.BuyerId == invoice.BuyerId && x.IsActive)
                .ToListAsync(cancellationToken);
            if (receipts.Count == 0)
            {
                return;
            }

            List<Guid> receiptIds = receipts.Select(x => x.Id).ToList();
            List<GoodsReceiptItem> lines = await repository.GoodsReceiptItem
                .FindByCondition(x => receiptIds.Contains(x.GoodsReceiptId) && x.IsActive)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, decimal> invoiced = await InvoicedExcludingAsync(repository, invoice.BuyerId, invoice.Id, lines.Select(x => x.Id).ToList(), cancellationToken);
            Dictionary<Guid, decimal> remainingByPoItem = new Dictionary<Guid, decimal>();
            foreach (GoodsReceiptItem line in lines)
            {
                GoodsReceipt? receipt = receipts.FirstOrDefault(x => x.Id == line.GoodsReceiptId);
                if (receipt == null)
                {
                    continue;
                }

                decimal received = line.AcceptedQty > 0 ? line.AcceptedQty : line.ReceivedQty;
                decimal net = Math.Max(0, received - ConfirmedReversedQty(receipt, line));
                decimal left = net - invoiced.GetValueOrDefault(line.Id);
                remainingByPoItem[line.PurchaseOrderItemId] = remainingByPoItem.GetValueOrDefault(line.PurchaseOrderItemId) + left;
            }

            foreach (InvoiceItem item in items.Where(x => x.IsActive && x.PurchaseOrderItemId != null))
            {
                decimal qty = item.Quantity ?? 0;
                if (qty <= 0)
                {
                    continue;
                }

                decimal left = remainingByPoItem.GetValueOrDefault(item.PurchaseOrderItemId!.Value);
                if (qty > left)
                {
                    throw new BadRequestCustomException("Invoice quantity exceeds remaining received quantity.", EXCEEDS_REVERSAL);
                }

                remainingByPoItem[item.PurchaseOrderItemId.Value] = left - qty;
            }
        }

        public static async Task<Dictionary<Guid, (decimal Net, decimal Remaining)>> ForInvoiceLinesAsync(
            IRepositoryWrapper repository,
            Invoice invoice,
            IReadOnlyCollection<InvoiceItem> items,
            CancellationToken cancellationToken)
        {
            Dictionary<Guid, (decimal Net, decimal Remaining)> result = new();
            List<Guid> grnLineIds = items.Where(x => x.GoodsReceiptItemId != null).Select(x => x.GoodsReceiptItemId!.Value).Distinct().ToList();
            if (grnLineIds.Count == 0)
            {
                return result;
            }

            List<GoodsReceiptItem> lines = await repository.GoodsReceiptItem
                .FindByCondition(x => grnLineIds.Contains(x.Id) && x.IsActive)
                .ToListAsync(cancellationToken);
            List<Guid> receiptIds = lines.Select(x => x.GoodsReceiptId).Distinct().ToList();
            List<GoodsReceipt> receipts = receiptIds.Count == 0
                ? new List<GoodsReceipt>()
                : await repository.GoodsReceipt.FindByCondition(x => receiptIds.Contains(x.Id)).ToListAsync(cancellationToken);
            Dictionary<Guid, decimal> invoiced = await InvoicedExcludingAsync(repository, invoice.BuyerId, invoice.Id, grnLineIds, cancellationToken);
            foreach (GoodsReceiptItem line in lines)
            {
                GoodsReceipt? receipt = receipts.FirstOrDefault(x => x.Id == line.GoodsReceiptId);
                decimal received = line.AcceptedQty > 0 ? line.AcceptedQty : line.ReceivedQty;
                decimal net = Math.Max(0, received - (receipt == null ? 0 : ConfirmedReversedQty(receipt, line)));
                result[line.Id] = (net, net - invoiced.GetValueOrDefault(line.Id));
            }

            return result;
        }

        private static async Task<Dictionary<Guid, decimal>> InvoicedExcludingAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            Guid invoiceId,
            List<Guid> goodsReceiptItemIds,
            CancellationToken cancellationToken)
        {
            if (goodsReceiptItemIds.Count == 0)
            {
                return new Dictionary<Guid, decimal>();
            }

            List<InvoiceItem> items = await repository.InvoiceItem
                .FindByCondition(x => x.IsActive && x.InvoiceId != invoiceId && x.GoodsReceiptItemId != null && goodsReceiptItemIds.Contains(x.GoodsReceiptItemId.Value))
                .ToListAsync(cancellationToken);
            List<Guid> invoiceIds = items.Select(x => x.InvoiceId).Distinct().ToList();
            List<Invoice> invoices = invoiceIds.Count == 0
                ? new List<Invoice>()
                : await repository.Invoice.FindByCondition(x => invoiceIds.Contains(x.Id) && x.BuyerId == buyerId && x.IsActive).ToListAsync(cancellationToken);
            HashSet<Guid> counting = invoices
                .Where(x => SilaInvoiceLifecycle.AlreadyPosted(x.Status, null)
                    || x.Status is Common.SILA_INVOICE_POSTING or Common.SILA_INVOICE_PENDING_APPROVAL
                    or Common.SILA_INVOICE_READY_TO_POST or Common.SILA_INVOICE_READY or Common.SILA_INVOICE_POSTING_UNKNOWN)
                .Select(x => x.Id)
                .ToHashSet();
            return items
                .Where(x => counting.Contains(x.InvoiceId))
                .GroupBy(x => x.GoodsReceiptItemId!.Value)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity ?? 0));
        }
    }
}
