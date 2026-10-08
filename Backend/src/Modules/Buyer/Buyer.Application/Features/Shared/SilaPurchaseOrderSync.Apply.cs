using System.Globalization;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    public static partial class SilaPurchaseOrderSync
    {
        /// <summary>
        /// Stages the valid purchase orders (NEW and UPDATE) on the repository; the caller saves. Suppliers named only by an
        /// ERP record are added to the Supplier Master first.
        /// </summary>
        public static void Apply(IRepositoryWrapper repository, BuyerBusinessProfile buyer, IEnumerable<Plan> plans, string sourceSystem)
        {
            Dictionary<string, SilaSupplier> created = new Dictionary<string, SilaSupplier>(StringComparer.OrdinalIgnoreCase);
            foreach (Plan plan in plans.Where(x => x.Errors.Count == 0 && x.Action != SilaReceivingExcel.ACTION_UNCHANGED))
            {
                SilaSupplier supplier = plan.Supplier ?? AddSupplier(repository, buyer.Id, plan.NewSupplier!, created);
                PurchaseOrder purchaseOrder = plan.Existing ?? new PurchaseOrder
                {
                    Id = Guid.NewGuid(),
                    BuyerId = buyer.Id,
                    BuyerOrganizationId = buyer.OrganizationId,
                    PoNumber = plan.PoNumber,
                    SourceType = SOURCE_ERP,
                    SupplierId = SupplierIdOf(supplier),
                    IsActive = true
                };
                purchaseOrder.SupplierName = supplier.Name;
                purchaseOrder.CompanyCode = plan.CompanyCode;
                purchaseOrder.PlantCode = plan.Plant;
                purchaseOrder.Currency = plan.Currency;
                purchaseOrder.OrderDate = plan.OrderDate;
                purchaseOrder.DeliveryDate = plan.DeliveryDate ?? purchaseOrder.DeliveryDate;
                purchaseOrder.SourceSystem = sourceSystem;
                purchaseOrder.TotalAmount = plan.TotalAmount ?? plan.Lines.Sum(x => x.Quantity * (x.UnitPrice ?? 0));

                Dictionary<int, PurchaseOrderItem> existingItems = plan.ExistingItems.GroupBy(x => x.LineNumber).ToDictionary(x => x.Key, x => x.First());
                List<(decimal Ordered, decimal Received)> quantities = new List<(decimal, decimal)>();
                foreach (Line line in plan.Lines)
                {
                    PurchaseOrderItem? item = existingItems.GetValueOrDefault(line.LineNumber);
                    bool isNew = item == null;
                    item ??= new PurchaseOrderItem
                    {
                        Id = Guid.NewGuid(),
                        PurchaseOrderId = purchaseOrder.Id,
                        LineNumber = line.LineNumber,
                        CatalogId = Guid.Empty,
                        ReceivedQuantity = line.ReceivedQuantity,
                        IsActive = true
                    };
                    item.MaterialCode = line.MaterialCode;
                    item.Sku = line.MaterialCode;
                    item.ProductName = line.ProductName;
                    item.Quantity = line.Quantity;
                    item.UnitOfMeasure = line.Uom;
                    item.UnitPrice = line.UnitPrice;
                    item.LineAmount = line.Quantity * (line.UnitPrice ?? 0);
                    item.GoodsReceiptExpected = line.GoodsReceiptExpected ?? item.GoodsReceiptExpected;
                    item.Currency = plan.Currency;
                    if (isNew)
                    {
                        repository.PurchaseOrderItem.Create(item);
                    }
                    else
                    {
                        repository.PurchaseOrderItem.Update(item);
                    }

                    quantities.Add((item.Quantity, item.ReceivedQuantity));
                }

                // Lines the ERP no longer sends (none of them was received: checked before).
                foreach (PurchaseOrderItem removed in plan.ExistingItems.Where(x => plan.Lines.All(line => line.LineNumber != x.LineNumber)))
                {
                    removed.IsActive = false;
                    repository.PurchaseOrderItem.Update(removed);
                }

                purchaseOrder.Status = StatusOf(quantities, plan.Existing?.Status);
                if (plan.Existing == null)
                {
                    repository.PurchaseOrder.Create(purchaseOrder);
                }
                else
                {
                    repository.PurchaseOrder.Update(purchaseOrder);
                }
            }
        }

        /// <summary>The supplier id ERP purchase orders carry: the linked network supplier, otherwise the Supplier Master row.</summary>
        public static Guid SupplierIdOf(SilaSupplier supplier)
        {
            return supplier.SupplierOrganizationId ?? supplier.Id;
        }

        private static SilaSupplier AddSupplier(IRepositoryWrapper repository, Guid buyerId, SilaSupplierWriteDto input, Dictionary<string, SilaSupplier> created)
        {
            SilaSupplierWriteDto normalized = SilaMasterDataRules.Normalize(input);
            if (created.TryGetValue(normalized.SupplierCode, out SilaSupplier? known))
            {
                return known;
            }

            SilaSupplier supplier = new SilaSupplier { Id = Guid.NewGuid(), BuyerId = buyerId };
            SilaMasterDataRules.Apply(supplier, normalized);
            repository.SilaSupplier.Create(supplier);
            created[normalized.SupplierCode] = supplier;
            return supplier;
        }

        private static string StatusOf(List<(decimal Ordered, decimal Received)> quantities, string? current)
        {
            if (current == SilaReceivingRules.PO_CANCELLED)
            {
                return current;
            }

            if (quantities.Count > 0 && quantities.All(x => x.Ordered - x.Received <= TOLERANCE))
            {
                return Common.SILA_PO_RECEIVED;
            }

            return quantities.Any(x => x.Received > 0) ? Common.SILA_PO_PARTIALLY_RECEIVED : STATUS_OPEN;
        }

        private static bool Same(string? left, string? right)
        {
            return string.Equals((left ?? string.Empty).Trim(), (right ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase);
        }

        private static void Require(List<string> errors, string? value, string label)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add($"{label} is required.");
            }
        }

        private static string? Upper(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
        }

        private static decimal? ParseDecimal(string? value)
        {
            return decimal.TryParse(value?.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out decimal result) ? result : null;
        }

        private static DateTime? ParseDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return DateTime.TryParseExact(value.Trim(), DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out DateTime date)
                ? date.Date
                : null;
        }

        private static string Truncate(string value, int length)
        {
            return value.Length > length ? value[..length] : value;
        }
    }
}
