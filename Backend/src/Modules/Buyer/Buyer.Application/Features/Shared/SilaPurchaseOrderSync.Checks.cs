using System.Globalization;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    public static partial class SilaPurchaseOrderSync
    {
        // Everything the checks need, read once per batch.
        private sealed class Lookups
        {
            public HashSet<string> CompanyCodes { get; } = new(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, SilaSupplier> Suppliers { get; } = new(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, PurchaseOrder> PurchaseOrders { get; } = new(StringComparer.OrdinalIgnoreCase);
            public Dictionary<Guid, List<PurchaseOrderItem>> Items { get; } = new();
            public Dictionary<string, string> MaterialNames { get; } = new(StringComparer.OrdinalIgnoreCase);
        }

        private static async Task<Lookups> LoadAsync(IRepositoryWrapper repository, Guid buyerId, List<SilaPoImportRowDto> rows, List<string> poNumbers, CancellationToken cancellationToken)
        {
            Lookups lookups = new Lookups();
            lookups.CompanyCodes.UnionWith(await repository.CompanyCodeMaster
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive).Select(x => x.Code).ToListAsync(cancellationToken));
            lookups.CompanyCodes.UnionWith(await repository.BuyerProperty
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive).Select(x => x.CompanyCode).ToListAsync(cancellationToken));

            List<string> supplierCodes = rows.Select(x => Upper(x.SupplierCode)).OfType<string>().Distinct().ToList();
            foreach (string[] chunk in supplierCodes.Chunk(500))
            {
                foreach (SilaSupplier supplier in await repository.SilaSupplier.FindByCondition(x => x.BuyerId == buyerId && chunk.Contains(x.SupplierCode)).ToListAsync(cancellationToken))
                {
                    lookups.Suppliers.TryAdd(supplier.SupplierCode, supplier);
                }
            }

            foreach (string[] chunk in poNumbers.Chunk(500))
            {
                foreach (PurchaseOrder purchaseOrder in await repository.PurchaseOrder.FindByCondition(x => x.BuyerId == buyerId && x.IsActive && chunk.Contains(x.PoNumber)).ToListAsync(cancellationToken))
                {
                    lookups.PurchaseOrders.TryAdd(purchaseOrder.PoNumber, purchaseOrder);
                }
            }

            List<Guid> purchaseOrderIds = lookups.PurchaseOrders.Values.Select(x => x.Id).ToList();
            foreach (Guid[] chunk in purchaseOrderIds.Chunk(500))
            {
                foreach (PurchaseOrderItem item in await repository.PurchaseOrderItem.FindByCondition(x => chunk.Contains(x.PurchaseOrderId) && x.IsActive).ToListAsync(cancellationToken))
                {
                    if (!lookups.Items.TryGetValue(item.PurchaseOrderId, out List<PurchaseOrderItem>? items))
                    {
                        items = new List<PurchaseOrderItem>();
                        lookups.Items[item.PurchaseOrderId] = items;
                    }

                    items.Add(item);
                }
            }

            List<string> materialCodes = rows.Where(x => string.IsNullOrWhiteSpace(x.Description)).Select(x => Upper(x.MaterialCode)).OfType<string>().Distinct().ToList();
            foreach (string[] chunk in materialCodes.Chunk(500))
            {
                foreach (ItemBuyerMaster material in await repository.ItemBuyerMaster.FindByCondition(x => x.BuyerId == buyerId && x.IsActive && chunk.Contains(x.MaterialCode)).ToListAsync(cancellationToken))
                {
                    lookups.MaterialNames.TryAdd(material.MaterialCode.Trim(), material.Description);
                }
            }

            return lookups;
        }

        private static void CheckSupplier(Plan plan, SilaPoImportRowDto head, List<string> errors, Lookups lookups, bool fromErp)
        {
            string? code = Upper(head.SupplierCode);
            if (code == null)
            {
                errors.Add("Supplier code is required.");
                return;
            }

            if (lookups.Suppliers.TryGetValue(code, out SilaSupplier? supplier) && supplier.IsActive)
            {
                if (supplier.Status != SilaMasterDataRules.STATUS_ACTIVE)
                {
                    errors.Add($"Supplier {code} is {supplier.Status} in the Supplier Master.");
                }

                plan.Supplier = supplier;
                plan.SupplierName = supplier.Name;
                return;
            }

            string? name = string.IsNullOrWhiteSpace(head.SupplierName) ? null : head.SupplierName.Trim();
            if (!fromErp || name == null)
            {
                errors.Add($"Supplier {code} is not in the Supplier Master; add it there first.");
                return;
            }

            plan.NewSupplier = new SilaSupplierWriteDto { SupplierCode = code, Name = name };
            plan.SupplierName = name;
        }

        private static void CheckExisting(Plan plan, List<string> errors, Lookups lookups)
        {
            if (!lookups.PurchaseOrders.TryGetValue(plan.PoNumber, out PurchaseOrder? existing))
            {
                return;
            }

            if (!string.Equals(existing.SourceType, SOURCE_ERP, StringComparison.OrdinalIgnoreCase))
            {
                errors.Add($"PO number {plan.PoNumber} belongs to a purchase order created in this application; use another number.");
                return;
            }

            plan.Existing = existing;
            plan.ExistingItems = lookups.Items.GetValueOrDefault(existing.Id) ?? new List<PurchaseOrderItem>();
            Guid? supplierId = plan.Supplier == null ? null : SupplierIdOf(plan.Supplier);
            if (supplierId != null && supplierId != existing.SupplierId)
            {
                errors.Add($"Purchase order {plan.PoNumber} belongs to another supplier; the supplier of a purchase order cannot change.");
            }
        }

        private static Line? CheckLine(SilaPoImportRowDto row, Plan plan, List<string> errors, Lookups lookups, bool fromErp)
        {
            int before = errors.Count;
            if (!int.TryParse(row.LineNumber, NumberStyles.Integer, CultureInfo.InvariantCulture, out int lineNumber) || lineNumber <= 0)
            {
                errors.Add("Line number must be a whole number above 0.");
            }
            else if (plan.Lines.Any(x => x.LineNumber == lineNumber))
            {
                errors.Add($"Line {lineNumber} appears twice in purchase order {plan.PoNumber}.");
            }

            decimal? quantity = ParseDecimal(row.Quantity);
            if (quantity == null || quantity <= 0 || quantity > SilaInputRules.MAX_QUANTITY)
            {
                errors.Add("Order quantity must be greater than 0 and at most 1,000,000,000.");
            }

            decimal? received = ParseDecimal(row.ReceivedQuantity);
            decimal? open = ParseDecimal(row.OpenQuantity);
            if ((row.ReceivedQuantity != null && (received == null || received < 0)) || (row.OpenQuantity != null && (open == null || open < 0)))
            {
                errors.Add("Open and received quantities must be 0 or more.");
            }
            else if (received != null && quantity != null && received > quantity + TOLERANCE)
            {
                errors.Add("Received quantity cannot exceed the order quantity.");
            }

            decimal? unitPrice = ParseDecimal(row.UnitPrice);
            if (row.UnitPrice != null && (unitPrice == null || unitPrice < 0 || unitPrice > SilaInputRules.MAX_QUANTITY))
            {
                errors.Add("Unit price must be a number between 0 and 1,000,000,000.");
            }

            string? itemCurrency = Upper(row.ItemCurrency);
            if (itemCurrency != null && plan.Currency != null && itemCurrency != plan.Currency)
            {
                errors.Add($"Line currency {itemCurrency} differs from the purchase order currency {plan.Currency}.");
            }

            string? materialCode = Upper(row.MaterialCode);
            string? description = string.IsNullOrWhiteSpace(row.Description) ? null : row.Description.Trim();
            if (materialCode == null && description == null)
            {
                errors.Add("Each line needs a material code or a description.");
            }

            string? grExpected = Upper(row.GoodsReceiptExpected);
            if ((!fromErp && grExpected == null) || (grExpected != null && grExpected != "TRUE" && grExpected != "FALSE"))
            {
                errors.Add("GoodsReceiptExpected must be TRUE or FALSE.");
            }

            if (errors.Count > before)
            {
                return null;
            }

            return new Line
            {
                RowNumber = row.RowNumber,
                LineNumber = lineNumber,
                MaterialCode = materialCode,
                ProductName = Truncate(description ?? lookups.MaterialNames.GetValueOrDefault(materialCode!) ?? materialCode!, 500),
                Quantity = quantity!.Value,
                Uom = Upper(row.Uom),
                UnitPrice = unitPrice,
                ReceivedQuantity = received ?? 0,
                GoodsReceiptExpected = grExpected == null ? null : grExpected == "TRUE"
            };
        }

        // Lines already received cannot disappear or drop under the received quantity; the action is NEW, UPDATE or UNCHANGED.
        private static void CheckLineChanges(Plan plan, List<string> errors)
        {
            if (plan.Existing == null)
            {
                plan.Action = SilaReceivingExcel.ACTION_NEW;
                return;
            }

            Dictionary<int, Line> incoming = plan.Lines.GroupBy(x => x.LineNumber).ToDictionary(x => x.Key, x => x.First());
            bool changed = plan.Existing.SupplierName != plan.SupplierName || plan.Existing.CompanyCode != plan.CompanyCode
                || plan.Existing.PlantCode != plan.Plant || plan.Existing.Currency != plan.Currency
                || (plan.TotalAmount != null && plan.Existing.TotalAmount != plan.TotalAmount)
                || plan.Existing.OrderDate.Date != plan.OrderDate.Date
                || plan.Existing.DeliveryDate?.Date != plan.DeliveryDate?.Date
                || plan.ExistingItems.Count != plan.Lines.Count;
            foreach (PurchaseOrderItem item in plan.ExistingItems)
            {
                if (!incoming.TryGetValue(item.LineNumber, out Line? line))
                {
                    if (item.ReceivedQuantity > 0)
                    {
                        errors.Add($"Line {item.LineNumber} of purchase order {plan.PoNumber} was already received and cannot be removed.");
                    }

                    continue;
                }

                if (line.Quantity + TOLERANCE < item.ReceivedQuantity)
                {
                    errors.Add($"Line {item.LineNumber}: {item.ReceivedQuantity:0.####} was already received; the order quantity cannot be lower.");
                }

                changed |= item.Quantity != line.Quantity || item.UnitPrice != line.UnitPrice || item.MaterialCode != line.MaterialCode
                    || item.ProductName != line.ProductName || item.UnitOfMeasure != line.Uom
                    || (line.GoodsReceiptExpected != null && item.GoodsReceiptExpected != line.GoodsReceiptExpected);
            }

            plan.Action = changed ? SilaReceivingExcel.ACTION_UPDATE : SilaReceivingExcel.ACTION_UNCHANGED;
        }
    }
}
