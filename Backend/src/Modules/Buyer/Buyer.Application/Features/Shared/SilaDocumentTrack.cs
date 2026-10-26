using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Builds the PO → GRN → Invoice → Attachment → Payment → SOA track for receiving documents.
    /// </summary>
    public static class SilaDocumentTrack
    {
        public const string KIND_PO = "PO";
        public const string KIND_GRN = "GRN";
        public const string KIND_INVOICE = "INVOICE";
        public const string KIND_CREDIT_MEMO = "CREDIT_MEMO";
        public const string KIND_ATTACHMENT = "ATTACHMENT";
        public const string KIND_PAYMENT = "PAYMENT";
        public const string KIND_SOA = "SOA";

        public static async Task<SilaDocumentTrackDto> ForPurchaseOrderAsync(
            IRepositoryWrapper repository, Guid buyerId, PurchaseOrder order, CancellationToken cancellationToken)
        {
            List<GoodsReceipt> grns = await repository.GoodsReceipt
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.PurchaseOrderId == order.Id)
                .OrderByDescending(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            return await BuildAsync(repository, buyerId, KIND_PO, order.Id, order, grns, null, null, cancellationToken);
        }

        public static async Task<SilaDocumentTrackDto> ForGoodsReceiptAsync(
            IRepositoryWrapper repository, Guid buyerId, GoodsReceipt receipt, CancellationToken cancellationToken)
        {
            PurchaseOrder? order = await repository.PurchaseOrder
                .FindByCondition(x => x.Id == receipt.PurchaseOrderId && x.BuyerId == buyerId)
                .FirstOrDefaultAsync(cancellationToken);
            List<GoodsReceipt> grns = order == null
                ? new List<GoodsReceipt> { receipt }
                : await repository.GoodsReceipt
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.PurchaseOrderId == order.Id)
                    .OrderByDescending(x => x.DateCreated)
                    .ToListAsync(cancellationToken);
            if (grns.All(x => x.Id != receipt.Id))
            {
                grns.Insert(0, receipt);
            }

            return await BuildAsync(repository, buyerId, KIND_GRN, receipt.Id, order, grns, null, null, cancellationToken);
        }

        public static async Task<SilaDocumentTrackDto> ForInvoiceAsync(
            IRepositoryWrapper repository, Guid buyerId, Invoice invoice, CancellationToken cancellationToken)
        {
            List<GoodsReceipt> linked = await repository.GoodsReceipt
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.InvoiceId == invoice.Id)
                .OrderByDescending(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            PurchaseOrder? order = null;
            if (invoice.PurchaseOrderId != null)
            {
                order = await repository.PurchaseOrder
                    .FindByCondition(x => x.Id == invoice.PurchaseOrderId.Value && x.BuyerId == buyerId)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            if (order == null && linked.Count > 0)
            {
                order = await repository.PurchaseOrder
                    .FindByCondition(x => x.Id == linked[0].PurchaseOrderId && x.BuyerId == buyerId)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            List<GoodsReceipt> grns = order == null
                ? linked
                : await repository.GoodsReceipt
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.PurchaseOrderId == order.Id)
                    .OrderByDescending(x => x.DateCreated)
                    .ToListAsync(cancellationToken);

            return await BuildAsync(repository, buyerId, KIND_INVOICE, invoice.Id, order, grns, invoice, null, cancellationToken);
        }

        public static async Task<SilaDocumentTrackDto> ForCreditMemoAsync(
            IRepositoryWrapper repository, Guid buyerId, CreditMemo memo, Invoice invoice, CancellationToken cancellationToken)
        {
            List<GoodsReceipt> linked = await repository.GoodsReceipt
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.InvoiceId == invoice.Id)
                .OrderByDescending(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            PurchaseOrder? order = invoice.PurchaseOrderId == null
                ? null
                : await repository.PurchaseOrder
                    .FindByCondition(x => x.Id == invoice.PurchaseOrderId.Value && x.BuyerId == buyerId)
                    .FirstOrDefaultAsync(cancellationToken);
            return await BuildAsync(repository, buyerId, KIND_CREDIT_MEMO, memo.Id, order, linked, invoice, memo, cancellationToken);
        }

        private static async Task<SilaDocumentTrackDto> BuildAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            string rootKind,
            Guid rootId,
            PurchaseOrder? order,
            List<GoodsReceipt> grns,
            Invoice? focusInvoice,
            CreditMemo? focusCreditMemo,
            CancellationToken cancellationToken)
        {
            List<Guid> invoiceIds = grns.Where(x => x.InvoiceId != null).Select(x => x.InvoiceId!.Value).Distinct().ToList();
            if (focusInvoice != null && !invoiceIds.Contains(focusInvoice.Id))
            {
                invoiceIds.Add(focusInvoice.Id);
            }

            if (order != null)
            {
                List<Guid> poInvoiceIds = await repository.Invoice
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.PurchaseOrderId == order.Id)
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken);
                foreach (Guid id in poInvoiceIds)
                {
                    if (!invoiceIds.Contains(id))
                    {
                        invoiceIds.Add(id);
                    }
                }
            }

            Dictionary<Guid, Invoice> invoices = invoiceIds.Count == 0
                ? new Dictionary<Guid, Invoice>()
                : await repository.Invoice.FindByCondition(x => invoiceIds.Contains(x.Id) && x.IsActive)
                    .ToDictionaryAsync(x => x.Id, cancellationToken);

            List<CreditMemo> creditMemos = invoiceIds.Count == 0
                ? new List<CreditMemo>()
                : await repository.CreditMemo
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && invoiceIds.Contains(x.ReferenceInvoiceId))
                    .OrderBy(x => x.DateCreated)
                    .ToListAsync(cancellationToken);
            if (focusCreditMemo != null && creditMemos.All(x => x.Id != focusCreditMemo.Id))
            {
                creditMemos.Add(focusCreditMemo);
            }

            List<Guid> postingIds = grns.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value)
                .Concat(invoices.Values.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value))
                .Concat(creditMemos.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value))
                .Distinct()
                .ToList();
            Dictionary<Guid, InventoryErpPosting> postings = postingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await repository.InventoryErpPosting.FindByCondition(x => postingIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);

            List<InventoryErpPosting> attachments = invoiceIds.Count == 0
                ? new List<InventoryErpPosting>()
                : await repository.InventoryErpPosting
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive
                        && x.ReferenceType == Common.SILA_REF_INVOICE_ATTACHMENT
                        && invoiceIds.Contains(x.ReferenceId))
                    .OrderByDescending(x => x.DateCreated)
                    .ToListAsync(cancellationToken);

            List<SilaDocumentTrackNodeDto> nodes = new List<SilaDocumentTrackNodeDto>();
            if (order != null)
            {
                nodes.Add(new SilaDocumentTrackNodeDto
                {
                    Kind = KIND_PO,
                    Id = order.Id,
                    Label = "Purchase order",
                    Number = order.PoNumber,
                    Status = order.Status,
                    Current = rootKind == KIND_PO
                });
            }

            foreach (GoodsReceipt grn in grns.OrderBy(x => x.DateCreated))
            {
                InventoryErpPosting? grnPosting = grn.ErpPostingId != null && postings.TryGetValue(grn.ErpPostingId.Value, out InventoryErpPosting? gp) ? gp : null;
                bool reversalDoc = grn.ParentGoodsReceiptId != null;
                nodes.Add(new SilaDocumentTrackNodeDto
                {
                    Kind = KIND_GRN,
                    Id = grn.Id,
                    Label = reversalDoc ? "Goods receipt reversal" : "Goods receipt",
                    Number = grn.GrnNumber,
                    Status = grn.Status,
                    ErpReference = grn.MaterialDocument ?? grnPosting?.ErpReference,
                    Current = rootKind == KIND_GRN && grn.Id == rootId
                });
                if (!reversalDoc && !string.IsNullOrWhiteSpace(grn.ReversalGrnNumber) && grns.All(x => x.GrnNumber != grn.ReversalGrnNumber))
                {
                    nodes.Add(new SilaDocumentTrackNodeDto
                    {
                        Kind = KIND_GRN,
                        Id = grn.ReversalGoodsReceiptId ?? grn.Id,
                        Label = "Goods receipt reversal",
                        Number = grn.ReversalGrnNumber,
                        Status = Common.SILA_GRN_REVERSED,
                        ErpReference = grn.ReversalMaterialDocument,
                        Current = false
                    });
                }
            }

            foreach (Invoice invoice in invoices.Values.OrderByDescending(x => x.DateCreated))
            {
                InventoryErpPosting? invPosting = invoice.ErpPostingId != null && postings.TryGetValue(invoice.ErpPostingId.Value, out InventoryErpPosting? ip) ? ip : null;
                nodes.Add(new SilaDocumentTrackNodeDto
                {
                    Kind = KIND_INVOICE,
                    Id = invoice.Id,
                    Label = "Supplier invoice",
                    Number = invoice.InvoiceNumber ?? invoice.FileName,
                    Status = invoice.Status,
                    ErpReference = invPosting?.ErpReference,
                    Current = rootKind == KIND_INVOICE && invoice.Id == rootId
                });

                InventoryErpPosting? attachment = attachments.FirstOrDefault(x => x.ReferenceId == invoice.Id);
                nodes.Add(new SilaDocumentTrackNodeDto
                {
                    Kind = KIND_ATTACHMENT,
                    Id = attachment?.Id,
                    Label = "S/4 attachment",
                    Number = invoice.InvoiceNumber,
                    Status = attachment?.Status ?? (invPosting?.Status == Common.SILA_POSTING_POSTED ? "PENDING" : "NOT_STARTED"),
                    ErpReference = attachment?.ErpReference,
                    Current = false
                });

                string paymentStatus = invoice.Status is Common.SILA_INVOICE_AWAITING_PAYMENT
                    or Common.SILA_INVOICE_PARTIALLY_PAID
                    or Common.SILA_INVOICE_PAID
                    or Common.SILA_INVOICE_OVERDUE
                    ? invoice.Status
                    : invPosting?.Status == Common.SILA_POSTING_POSTED ? "AWAITING_PAYMENT" : "NOT_STARTED";
                nodes.Add(new SilaDocumentTrackNodeDto
                {
                    Kind = KIND_PAYMENT,
                    Id = invoice.Id,
                    Label = "Payment",
                    Number = invoice.InvoiceNumber,
                    Status = paymentStatus,
                    Current = false
                });

                foreach (CreditMemo memo in creditMemos.Where(x => x.ReferenceInvoiceId == invoice.Id))
                {
                    InventoryErpPosting? cmPosting = memo.ErpPostingId != null && postings.TryGetValue(memo.ErpPostingId.Value, out InventoryErpPosting? cp) ? cp : null;
                    nodes.Add(new SilaDocumentTrackNodeDto
                    {
                        Kind = KIND_CREDIT_MEMO,
                        Id = memo.Id,
                        Label = "Credit Memo",
                        Number = memo.CreditMemoNumber ?? memo.CreditMemoReference,
                        Status = memo.Status,
                        ErpReference = cmPosting?.ErpReference,
                        Current = rootKind == KIND_CREDIT_MEMO && memo.Id == rootId
                    });
                }
            }

            nodes.Add(new SilaDocumentTrackNodeDto
            {
                Kind = KIND_SOA,
                Label = "Statement of account",
                Status = "NOT_CONFIGURED",
                Current = false
            });

            List<Guid> historyIds = new List<Guid>();
            if (order != null)
            {
                historyIds.Add(order.Id);
            }

            historyIds.AddRange(grns.Select(x => x.Id));
            historyIds.AddRange(invoices.Keys);
            historyIds.AddRange(creditMemos.Select(x => x.Id));
            historyIds.AddRange(attachments.Select(x => x.Id));

            List<InventoryWorkflowEvent> events = historyIds.Count == 0
                ? new List<InventoryWorkflowEvent>()
                : await repository.InventoryWorkflowEvent
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && historyIds.Contains(x.ReferenceId))
                    .OrderByDescending(x => x.DateCreated)
                    .Take(40)
                    .ToListAsync(cancellationToken);

            List<SilaDocumentTrackAttachmentDto> files = new List<SilaDocumentTrackAttachmentDto>();
            foreach (Invoice invoice in invoices.Values)
            {
                if (!string.IsNullOrWhiteSpace(invoice.FileName))
                {
                    files.Add(new SilaDocumentTrackAttachmentDto
                    {
                        DocumentType = "Original Supplier Invoice",
                        FileName = invoice.FileName,
                        Status = invoice.Status,
                        InvoiceId = invoice.Id
                    });
                }

                InventoryErpPosting? attachment = attachments.FirstOrDefault(x => x.ReferenceId == invoice.Id);
                if (attachment != null)
                {
                    files.Add(new SilaDocumentTrackAttachmentDto
                    {
                        DocumentType = "S/4 URL Attachment",
                        FileName = SilaInvoiceAttachment.FileNameOf(invoice.FileName, invoice.InvoiceNumber),
                        Status = attachment.Status,
                        InvoiceId = invoice.Id,
                        Url = attachment.ErpReference
                    });
                }
            }

            return new SilaDocumentTrackDto
            {
                RootKind = rootKind,
                RootId = rootId,
                Nodes = nodes,
                History = events.Select(x => new SilaDocumentTrackEventDto
                {
                    Action = x.Action,
                    Comment = x.Comment,
                    OccurredOn = x.DateCreated,
                    ReferenceType = x.ReferenceType,
                    ReferenceId = x.ReferenceId
                }).ToList(),
                Attachments = files
            };
        }
    }
}
