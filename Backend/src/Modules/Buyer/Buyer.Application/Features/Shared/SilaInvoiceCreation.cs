using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Create Invoice: PO + GRN eligibility and Non-PO account masters from existing SILA data.
    /// Both modes still post through FIVE S4-INVOICE POSTING.
    /// </summary>
    public static class SilaInvoiceCreation
    {
        private static readonly HashSet<string> BlockingInvoiceStatuses = new(StringComparer.OrdinalIgnoreCase)
        {
            Common.SILA_INVOICE_POSTING,
            Common.SILA_INVOICE_POSTED,
            Common.SILA_INVOICE_AWAITING_PAYMENT,
            Common.SILA_INVOICE_PARTIALLY_PAID,
            Common.SILA_INVOICE_PAID,
            Common.SILA_INVOICE_OVERDUE,
            Common.SILA_INVOICE_PENDING_APPROVAL,
            Common.SILA_INVOICE_READY_TO_POST,
            Common.SILA_INVOICE_READY,
            Common.SILA_INVOICE_POSTING_UNKNOWN
        };

        public static bool IsNonPo(string? creationType) =>
            string.Equals(creationType, Common.SILA_INVOICE_CREATION_NON_PO, StringComparison.OrdinalIgnoreCase);

        public static bool IsPo(string? creationType) =>
            string.IsNullOrWhiteSpace(creationType)
            || string.Equals(creationType, Common.SILA_INVOICE_CREATION_PO, StringComparison.OrdinalIgnoreCase);

        public static async Task<string?> ResolveCompanyCodeAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            Guid? propertyId,
            string? companyCode,
            CancellationToken cancellationToken)
        {
            if (!string.IsNullOrWhiteSpace(companyCode))
            {
                return companyCode.Trim();
            }

            if (propertyId == null)
            {
                return null;
            }

            BuyerProperty? property = await repository.BuyerProperty.FindFirstByConditionAsync(
                x => x.Id == propertyId && x.BuyerId == buyerId && x.IsActive);
            return string.IsNullOrWhiteSpace(property?.CompanyCode) ? null : property.CompanyCode.Trim();
        }

        public static async Task<SilaCreateInvoiceMastersDto> MastersAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            CancellationToken cancellationToken)
        {
            List<BuyerProperty> properties = await repository.BuyerProperty
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .OrderBy(x => x.PropertyName)
                .ToListAsync(cancellationToken);
            List<CompanyCodeMaster> companies = await repository.CompanyCodeMaster
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .OrderBy(x => x.Code)
                .ToListAsync(cancellationToken);
            List<InventoryLocation> locations = await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .ToListAsync(cancellationToken);
            List<string> taxCodes = await repository.PurchaseOrderItem
                .FindByCondition(x => x.IsActive && x.TaxCode != null && x.TaxCode != "")
                .Select(x => x.TaxCode!)
                .Distinct()
                .OrderBy(x => x)
                .Take(200)
                .ToListAsync(cancellationToken);

            return new SilaCreateInvoiceMastersDto
            {
                Properties = properties.Select(x => new SilaCreateInvoicePropertyDto
                {
                    Id = x.Id,
                    PropertyName = x.PropertyName,
                    CompanyCode = x.CompanyCode,
                    PlantCode = x.PlantCode
                }).ToList(),
                CompanyCodes = companies.Select(x => new SilaCreateInvoiceCompanyDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    Name = x.Name
                }).ToList(),
                GlAccounts = locations.Select(x => x.GlAccount).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).ToList(),
                CostCenters = locations.Select(x => x.CostCenter).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).ToList(),
                ProfitCenters = locations.Select(x => x.ProfitCenter).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).ToList(),
                TaxCodes = taxCodes
            };
        }

        public static async Task<List<SilaEligiblePurchaseOrderDto>> EligiblePurchaseOrdersAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            Guid? silaSupplierId,
            Guid? supplierId,
            string? companyCode,
            CancellationToken cancellationToken)
        {
            IQueryable<PurchaseOrder> query = repository.PurchaseOrder.FindByCondition(x =>
                x.BuyerId == buyerId
                && x.IsActive
                && x.Status != SilaReceivingRules.PO_CANCELLED
                && x.Status != Common.SILA_PO_RECEIVED);
            if (!string.IsNullOrWhiteSpace(companyCode))
            {
                string company = companyCode.Trim();
                query = query.Where(x => x.CompanyCode == company);
            }

            List<PurchaseOrder> orders = await query.OrderByDescending(x => x.OrderDate).Take(200).ToListAsync(cancellationToken);
            if (silaSupplierId != null || supplierId != null)
            {
                SilaSupplier? sila = silaSupplierId == null
                    ? null
                    : await repository.SilaSupplier.FindFirstByConditionAsync(x => x.Id == silaSupplierId && x.BuyerId == buyerId);
                HashSet<Guid> supplierKeys = new HashSet<Guid>();
                if (supplierId != null)
                {
                    supplierKeys.Add(supplierId.Value);
                }

                string? code = sila?.SupplierCode?.Trim();
                string? name = sila?.Name?.Trim();
                orders = orders.Where(order =>
                {
                    if (supplierKeys.Contains(order.SupplierId))
                    {
                        return true;
                    }

                    if (!string.IsNullOrWhiteSpace(name)
                        && !string.IsNullOrWhiteSpace(order.SupplierName)
                        && string.Equals(order.SupplierName.Trim(), name, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }

                    return !string.IsNullOrWhiteSpace(code)
                        && !string.IsNullOrWhiteSpace(order.SupplierName)
                        && (order.SupplierName.Contains(code, StringComparison.OrdinalIgnoreCase)
                            || string.Equals(order.SupplierName.Trim(), code, StringComparison.OrdinalIgnoreCase));
                }).ToList();
            }

            List<Guid> orderIds = orders.Select(x => x.Id).ToList();
            List<PurchaseOrderItem> items = orderIds.Count == 0
                ? new List<PurchaseOrderItem>()
                : await repository.PurchaseOrderItem.FindByCondition(x => orderIds.Contains(x.PurchaseOrderId) && x.IsActive).ToListAsync(cancellationToken);
            List<GoodsReceipt> receipts = orderIds.Count == 0
                ? new List<GoodsReceipt>()
                : await repository.GoodsReceipt.FindByCondition(x => x.BuyerId == buyerId && x.IsActive && orderIds.Contains(x.PurchaseOrderId)).ToListAsync(cancellationToken);
            Dictionary<Guid, InventoryErpPosting> postings = await PostingsAsync(repository, receipts, cancellationToken);

            List<SilaEligiblePurchaseOrderDto> result = new List<SilaEligiblePurchaseOrderDto>();
            foreach (PurchaseOrder order in orders)
            {
                List<PurchaseOrderItem> orderItems = items.Where(x => x.PurchaseOrderId == order.Id).ToList();
                if (orderItems.Count == 0 || orderItems.All(x => x.Quantity - x.ReceivedQuantity <= 0) && receipts.Count(x => x.PurchaseOrderId == order.Id) == 0)
                {
                    // Keep POs that still have posted GRNs with remaining invoiceable qty.
                }

                List<GoodsReceipt> orderReceipts = receipts.Where(x => x.PurchaseOrderId == order.Id && EligibleReceipt(x, postings)).ToList();
                decimal ordered = orderItems.Sum(x => x.Quantity);
                decimal received = orderItems.Sum(x => x.ReceivedQuantity);
                if (orderReceipts.Count == 0 && orderItems.All(x => x.Quantity - x.ReceivedQuantity <= 0))
                {
                    continue;
                }

                result.Add(new SilaEligiblePurchaseOrderDto
                {
                    Id = order.Id,
                    PoNumber = order.PoNumber,
                    OrderDate = order.OrderDate,
                    CompanyCode = order.CompanyCode,
                    Currency = order.Currency,
                    TotalAmount = order.TotalAmount,
                    OrderedQuantity = ordered,
                    ReceivedQuantity = received,
                    GrnCount = orderReceipts.Count,
                    Status = order.Status,
                    SupplierName = order.SupplierName
                });
            }

            return result;
        }

        public static async Task<List<SilaEligibleGoodsReceiptDto>> EligibleGoodsReceiptsAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            Guid purchaseOrderId,
            CancellationToken cancellationToken)
        {
            PurchaseOrder? order = await repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == purchaseOrderId && x.BuyerId == buyerId && x.IsActive);
            if (order == null)
            {
                return new List<SilaEligibleGoodsReceiptDto>();
            }

            List<GoodsReceipt> receipts = await repository.GoodsReceipt
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.PurchaseOrderId == purchaseOrderId)
                .OrderByDescending(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, InventoryErpPosting> postings = await PostingsAsync(repository, receipts, cancellationToken);
            List<Guid> receiptIds = receipts.Select(x => x.Id).ToList();
            List<GoodsReceiptItem> lines = receiptIds.Count == 0
                ? new List<GoodsReceiptItem>()
                : await repository.GoodsReceiptItem.FindByCondition(x => receiptIds.Contains(x.GoodsReceiptId) && x.IsActive).ToListAsync(cancellationToken);
            List<Guid> poItemIds = lines.Select(x => x.PurchaseOrderItemId).Distinct().ToList();
            Dictionary<Guid, PurchaseOrderItem> poItems = poItemIds.Count == 0
                ? new Dictionary<Guid, PurchaseOrderItem>()
                : await repository.PurchaseOrderItem.FindByCondition(x => poItemIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, decimal> invoicedByGrnLine = await InvoicedByGoodsReceiptItemAsync(repository, buyerId, lines.Select(x => x.Id).ToList(), cancellationToken);
            List<Guid> heldInvoiceIds = receipts.Where(x => x.InvoiceId != null).Select(x => x.InvoiceId!.Value).Distinct().ToList();
            Dictionary<Guid, Invoice> held = heldInvoiceIds.Count == 0
                ? new Dictionary<Guid, Invoice>()
                : await repository.Invoice.FindByCondition(x => heldInvoiceIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);

            List<SilaEligibleGoodsReceiptDto> result = new List<SilaEligibleGoodsReceiptDto>();
            foreach (GoodsReceipt receipt in receipts)
            {
                if (!EligibleReceipt(receipt, postings))
                {
                    continue;
                }

                if (receipt.InvoiceId != null
                    && held.TryGetValue(receipt.InvoiceId.Value, out Invoice? invoice)
                    && BlockingInvoiceStatuses.Contains(invoice.Status)
                    && !string.Equals(invoice.Status, Common.SILA_INVOICE_POSTING_FAILED, StringComparison.OrdinalIgnoreCase))
                {
                    // Still show if remaining qty exists on lines; a partial invoice may leave room.
                }

                List<GoodsReceiptItem> receiptLines = lines.Where(x => x.GoodsReceiptId == receipt.Id).ToList();
                List<SilaEligibleGoodsReceiptLineDto> mapped = new List<SilaEligibleGoodsReceiptLineDto>();
                foreach (GoodsReceiptItem line in receiptLines)
                {
                    decimal received = line.AcceptedQty > 0 ? line.AcceptedQty : line.ReceivedQty;
                    decimal invoiced = Math.Max(line.InvoiceQty ?? 0, invoicedByGrnLine.GetValueOrDefault(line.Id));
                    decimal remaining = received - invoiced;
                    if (remaining <= 0)
                    {
                        continue;
                    }

                    poItems.TryGetValue(line.PurchaseOrderItemId, out PurchaseOrderItem? poItem);
                    mapped.Add(new SilaEligibleGoodsReceiptLineDto
                    {
                        Id = line.Id,
                        PurchaseOrderItemId = line.PurchaseOrderItemId,
                        PurchaseOrderItemNumber = poItem?.LineNumber,
                        Description = line.MaterialName,
                        MaterialCode = line.MaterialCode ?? poItem?.MaterialCode,
                        Uom = line.Uom ?? poItem?.UnitOfMeasure,
                        ReceivedQuantity = received,
                        InvoicedQuantity = invoiced,
                        RemainingQuantity = remaining,
                        UnitPrice = poItem?.UnitPrice,
                        TaxCode = poItem?.TaxCode
                    });
                }

                if (mapped.Count == 0)
                {
                    continue;
                }

                postings.TryGetValue(receipt.ErpPostingId ?? Guid.Empty, out InventoryErpPosting? posting);
                string? invoiceStatus = receipt.InvoiceId != null && held.TryGetValue(receipt.InvoiceId.Value, out Invoice? heldInvoice)
                    ? heldInvoice.Status
                    : null;
                result.Add(new SilaEligibleGoodsReceiptDto
                {
                    Id = receipt.Id,
                    GrnNumber = receipt.GrnNumber,
                    ErpReference = posting?.ErpReference,
                    ReceivedOn = receipt.DateCreated,
                    PoNumber = receipt.PoNumber,
                    SupplierName = order.SupplierName,
                    ReceivedQuantity = mapped.Sum(x => x.ReceivedQuantity),
                    InvoicedQuantity = mapped.Sum(x => x.InvoicedQuantity),
                    RemainingQuantity = mapped.Sum(x => x.RemainingQuantity),
                    Status = receipt.Status,
                    InvoiceStatus = invoiceStatus,
                    Lines = mapped
                });
            }

            return result;
        }

        public static List<InvoiceItem> LinesFromGoodsReceipts(
            IReadOnlyList<SilaEligibleGoodsReceiptDto> receipts,
            Guid userId)
        {
            List<InvoiceItem> items = new List<InvoiceItem>();
            int lineNumber = 0;
            foreach (SilaEligibleGoodsReceiptDto receipt in receipts)
            {
                foreach (SilaEligibleGoodsReceiptLineDto line in receipt.Lines)
                {
                    lineNumber++;
                    decimal qty = line.RemainingQuantity;
                    decimal? amount = line.UnitPrice == null ? null : Math.Round(qty * line.UnitPrice.Value, 2, MidpointRounding.AwayFromZero);
                    items.Add(new InvoiceItem
                    {
                        Id = Guid.NewGuid(),
                        LineNumber = lineNumber,
                        Description = line.Description,
                        Quantity = qty,
                        UnitPrice = line.UnitPrice,
                        Amount = amount,
                        PurchaseOrderItemId = line.PurchaseOrderItemId,
                        GoodsReceiptItemId = line.Id,
                        Uom = line.Uom,
                        TaxCode = line.TaxCode,
                        SupplierMaterialCode = line.MaterialCode,
                        MatchStatus = "MATCHED",
                        IsActive = true,
                        CreatedBy = userId,
                        UpdatedBy = userId,
                        DateCreated = DateTime.UtcNow,
                        DateUpdated = DateTime.UtcNow
                    });
                }
            }

            return items;
        }

        private static bool EligibleReceipt(GoodsReceipt receipt, IReadOnlyDictionary<Guid, InventoryErpPosting> postings)
        {
            if (string.Equals(receipt.Status, "FAILED", StringComparison.OrdinalIgnoreCase)
                || string.Equals(receipt.Status, "CANCELLED", StringComparison.OrdinalIgnoreCase)
                || string.Equals(receipt.Status, "REVERSED", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (receipt.ErpPostingId == null)
            {
                return receipt.Status == Common.SILA_GRN_POSTED;
            }

            if (!postings.TryGetValue(receipt.ErpPostingId.Value, out InventoryErpPosting? posting))
            {
                return false;
            }

            return posting.Status is Common.SILA_POSTING_POSTED or Common.SILA_POSTING_ERP_ACCEPTED or Common.SILA_POSTING_FAILED_LOCAL
                || !string.IsNullOrWhiteSpace(posting.ErpReference);
        }

        private static async Task<Dictionary<Guid, InventoryErpPosting>> PostingsAsync(
            IRepositoryWrapper repository,
            IReadOnlyList<GoodsReceipt> receipts,
            CancellationToken cancellationToken)
        {
            List<Guid> ids = receipts.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).Distinct().ToList();
            if (ids.Count == 0)
            {
                return new Dictionary<Guid, InventoryErpPosting>();
            }

            return await repository.InventoryErpPosting.FindByCondition(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        }

        private static async Task<Dictionary<Guid, decimal>> InvoicedByGoodsReceiptItemAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            List<Guid> goodsReceiptItemIds,
            CancellationToken cancellationToken)
        {
            if (goodsReceiptItemIds.Count == 0)
            {
                return new Dictionary<Guid, decimal>();
            }

            List<InvoiceItem> items = await repository.InvoiceItem
                .FindByCondition(x => x.IsActive && x.GoodsReceiptItemId != null && goodsReceiptItemIds.Contains(x.GoodsReceiptItemId.Value))
                .ToListAsync(cancellationToken);
            List<Guid> invoiceIds = items.Select(x => x.InvoiceId).Distinct().ToList();
            List<Invoice> invoices = invoiceIds.Count == 0
                ? new List<Invoice>()
                : await repository.Invoice.FindByCondition(x => invoiceIds.Contains(x.Id) && x.BuyerId == buyerId && x.IsActive).ToListAsync(cancellationToken);
            HashSet<Guid> counting = invoices
                .Where(x => BlockingInvoiceStatuses.Contains(x.Status) || x.Status == Common.SILA_INVOICE_REVIEWED || x.Status == Common.SILA_INVOICE_EXTRACTED || x.Status == Common.SILA_INVOICE_GRN_POSTED)
                .Select(x => x.Id)
                .ToHashSet();
            return items
                .Where(x => counting.Contains(x.InvoiceId))
                .GroupBy(x => x.GoodsReceiptItemId!.Value)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity ?? 0));
        }
    }
}
