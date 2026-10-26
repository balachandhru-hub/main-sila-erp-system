using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// V1 purchase recommendations: reuses <see cref="SilaStockLevels"/> (min / reorder / par) and adds open PO
    /// quantity so incoming stock is not double-ordered. Weekly-bucket substitute recommendations and live-inventory
    /// transfer advice are not used here.
    /// Formula: AvailableEffective = CurrentAvailable + OpenPoQty; Recommended = (Par ?? Threshold) − AvailableEffective
    /// when AvailableEffective is at or under Threshold (ReorderPoint ?? MinimumStock).
    /// </summary>
    public static class SilaPurchaseRecommendation
    {
        public const string REASON_STOCK_OUT = "STOCK_OUT";
        public const string REASON_BELOW_MINIMUM = "BELOW_MINIMUM";
        public const string REASON_BELOW_PAR = "BELOW_PAR";
        public const string MISSING_THRESHOLD = "MISSING_THRESHOLD";
        public const string MISSING_CATALOG = "MISSING_CATALOG";
        public const string MISSING_SUPPLIER = "MISSING_SUPPLIER";
        public const string MISSING_PRICE = "MISSING_PRICE";
        public const string MISSING_UOM_CONVERSION = "MISSING_UOM_CONVERSION";

        private const int MAX_ROWS = 200;

        public static async Task<SilaPurchaseRecommendationListDto> BuildAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            List<InventoryLocation> scope,
            int month,
            CancellationToken cancellationToken)
        {
            SilaPurchaseRecommendationListDto result = new SilaPurchaseRecommendationListDto();
            if (scope.Count == 0)
            {
                return result;
            }

            List<Guid> scopeIds = scope.Select(x => x.Id).ToList();
            List<InventoryLocationMaterial> stocking = await repository.InventoryLocationMaterial
                .FindByCondition(x => x.IsActive && scopeIds.Contains(x.LocationId))
                .ToListAsync(cancellationToken);
            if (stocking.Count == 0)
            {
                return result;
            }

            List<Guid> materialIds = stocking.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<(Guid LocationId, Guid MaterialId), decimal> onHand = (await repository.InventoryBalance
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && materialIds.Contains(x.MaterialId) && scopeIds.Contains(x.LocationId))
                    .Select(x => new { x.LocationId, x.MaterialId, x.OnHandQty })
                    .ToListAsync(cancellationToken))
                .GroupBy(x => (x.LocationId, x.MaterialId))
                .ToDictionary(x => x.Key, x => x.Sum(row => row.OnHandQty));
            Dictionary<Guid, ItemBuyerMaster> materials = await repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<(Guid LocationMaterialId, int Month), LocationMaterialThreshold> thresholds = await SilaStockLevels.GetThresholdsAsync(
                repository, stocking.Select(x => x.Id).ToList(), month, cancellationToken);
            Dictionary<(Guid LocationId, Guid MaterialId), InternalPurchaseRequest> openRequests = (await repository.InternalPurchaseRequest
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == Common.SILA_PR_SUBMITTED
                        && scopeIds.Contains(x.LocationId) && materialIds.Contains(x.MaterialId))
                    .ToListAsync(cancellationToken))
                .GroupBy(x => (x.LocationId, x.MaterialId))
                .ToDictionary(x => x.Key, x => x.First());
            List<CatalogMaterialMapping> mappings = await repository.CatalogMaterialMapping
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && materialIds.Contains(x.MaterialId))
                .OrderBy(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, CatalogMaterialMapping> catalogByMaterial = mappings
                .GroupBy(x => x.MaterialId)
                .ToDictionary(x => x.Key, x => x.First());
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                repository, materials.Keys, cancellationToken);
            List<Guid> propertyIds = scope.Select(x => x.PropertyId).Distinct().ToList();
            Dictionary<Guid, BuyerProperty> properties = propertyIds.Count == 0
                ? new Dictionary<Guid, BuyerProperty>()
                : await repository.BuyerProperty.FindByCondition(x => propertyIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<(Guid LocationId, Guid MaterialId), OpenSupply> incoming = await OpenSupplyAsync(
                repository, buyerId, scope, properties, materials, conversions, cancellationToken);
            Dictionary<Guid, InventoryLocation> locations = scope.ToDictionary(x => x.Id);

            foreach (InventoryLocationMaterial row in stocking)
            {
                if (!materials.TryGetValue(row.MaterialId, out ItemBuyerMaster? material)
                    || !locations.TryGetValue(row.LocationId, out InventoryLocation? location))
                {
                    continue;
                }

                SilaEffectiveLevels levels = SilaStockLevels.Effective(row, thresholds, month);
                if (levels.Threshold == null)
                {
                    result.Skipped.Add(new SilaPurchaseRecommendationSkipDto
                    {
                        MaterialId = material.Id,
                        MaterialCode = material.MaterialCode,
                        LocationId = location.Id,
                        LocationName = location.LocationName,
                        Reason = MISSING_THRESHOLD
                    });
                    continue;
                }

                decimal current = onHand.TryGetValue((row.LocationId, row.MaterialId), out decimal stock) ? stock : 0;
                incoming.TryGetValue((row.LocationId, row.MaterialId), out OpenSupply supply);
                decimal openPo = supply.Qty;
                decimal effective = current + openPo;
                decimal? recommendedBase = SilaStockLevels.RecommendedQuantity(effective, levels);
                if (recommendedBase == null)
                {
                    continue;
                }

                string baseUom = UomConverter.BaseUomOf(material);
                string purchaseUom = PurchaseUomOf(material, baseUom);
                decimal? purchaseQty = ToPurchaseQty(material, recommendedBase.Value, purchaseUom, conversions);
                if (purchaseQty == null)
                {
                    result.Skipped.Add(new SilaPurchaseRecommendationSkipDto
                    {
                        MaterialId = material.Id,
                        MaterialCode = material.MaterialCode,
                        LocationId = location.Id,
                        LocationName = location.LocationName,
                        Reason = MISSING_UOM_CONVERSION
                    });
                    continue;
                }

                catalogByMaterial.TryGetValue(material.Id, out CatalogMaterialMapping? catalog);
                string reason = ReasonOf(current, levels);
                string? configuration = ConfigurationOf(catalog, supply, material);
                openRequests.TryGetValue((location.Id, material.Id), out InternalPurchaseRequest? request);
                bool duplicate = request != null;
                decimal? unitPrice = supply.UnitPrice ?? material.UnitCost;
                string? currency = supply.Currency ?? material.Currency;
                decimal? estimated = unitPrice == null ? null : Math.Round(purchaseQty.Value * unitPrice.Value, 2, MidpointRounding.AwayFromZero);

                result.Items.Add(new SilaPurchaseRecommendationDto
                {
                    MaterialId = material.Id,
                    MaterialCode = material.MaterialCode ?? string.Empty,
                    MaterialName = material.Description ?? material.MaterialCode ?? string.Empty,
                    LocationId = location.Id,
                    LocationName = location.LocationName,
                    PlantCode = properties.TryGetValue(location.PropertyId, out BuyerProperty? property) ? property.PlantCode : null,
                    StorageLocationCode = location.StorageLocationCode,
                    CurrentStock = current,
                    MinimumStock = levels.MinimumStock,
                    ReorderPoint = levels.ReorderPoint,
                    ParLevel = levels.ParLevel,
                    OpenPoQty = openPo,
                    AvailableEffectiveStock = effective,
                    RecommendedQty = purchaseQty.Value,
                    PurchaseUom = purchaseUom,
                    BaseUom = baseUom,
                    CatalogId = catalog?.CatalogId,
                    CatalogSku = catalog?.Sku,
                    SupplierId = supply.SupplierId,
                    SupplierName = supply.SupplierName,
                    UnitPrice = unitPrice,
                    Currency = currency,
                    EstimatedValue = estimated,
                    Reason = reason,
                    ConfigurationIssue = configuration,
                    OpenPurchaseRequestNumber = request?.RequestNumber,
                    OpenPurchaseRequestId = request?.Id,
                    DuplicateBlocked = duplicate,
                    CanAddToPo = !duplicate && catalog != null
                });
            }

            result.Items = result.Items
                .OrderBy(x => x.Reason == REASON_STOCK_OUT ? 0 : x.Reason == REASON_BELOW_MINIMUM ? 1 : 2)
                .ThenBy(x => x.LocationName)
                .ThenBy(x => x.MaterialName)
                .Take(MAX_ROWS)
                .ToList();
            result.StockOut = result.Items.Count(x => x.Reason == REASON_STOCK_OUT);
            result.BelowMinimum = result.Items.Count(x => x.Reason == REASON_BELOW_MINIMUM);
            result.BelowPar = result.Items.Count(x => x.Reason == REASON_BELOW_PAR);
            result.RecommendedPurchase = result.Items.Count;
            IEnumerable<SilaPurchaseRecommendationDto> valued = result.Items.Where(x => x.EstimatedValue != null);
            if (valued.Any())
            {
                result.EstimatedValue = valued.Sum(x => x.EstimatedValue!.Value);
                result.EstimatedCurrency = valued.Select(x => x.Currency).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));
            }

            return result;
        }

        private static string ReasonOf(decimal current, SilaEffectiveLevels levels)
        {
            if (current <= 0)
            {
                return REASON_STOCK_OUT;
            }

            if (levels.MinimumStock != null && current <= levels.MinimumStock.Value)
            {
                return REASON_BELOW_MINIMUM;
            }

            if (levels.ParLevel != null && levels.ParLevel.Value > 0)
            {
                return REASON_BELOW_PAR;
            }

            return REASON_BELOW_MINIMUM;
        }

        private static string? ConfigurationOf(CatalogMaterialMapping? catalog, OpenSupply supply, ItemBuyerMaster material)
        {
            if (catalog == null)
            {
                return MISSING_CATALOG;
            }

            if (supply.SupplierId == null && string.IsNullOrWhiteSpace(supply.SupplierName))
            {
                return MISSING_SUPPLIER;
            }

            if (supply.UnitPrice == null && material.UnitCost == null)
            {
                return MISSING_PRICE;
            }

            return null;
        }

        private static string PurchaseUomOf(ItemBuyerMaster material, string baseUom)
        {
            return string.IsNullOrWhiteSpace(material.OrderUnitOfMeasure)
                ? baseUom
                : UomConverter.Canonical(material.OrderUnitOfMeasure);
        }

        /// <summary>Recommended base quantity expressed in the purchase UOM. Null when the conversion is missing.</summary>
        private static decimal? ToPurchaseQty(
            ItemBuyerMaster material,
            decimal baseQuantity,
            string purchaseUom,
            Dictionary<Guid, List<MaterialUomConversion>> conversions)
        {
            if (purchaseUom == UomConverter.BaseUomOf(material))
            {
                return baseQuantity;
            }

            decimal? onePurchase = UomConverter.TryToBase(material, 1, purchaseUom, conversions);
            if (onePurchase == null || onePurchase.Value <= 0)
            {
                return null;
            }

            return Math.Round(baseQuantity / onePurchase.Value, 4, MidpointRounding.AwayFromZero);
        }

        private static async Task<Dictionary<(Guid LocationId, Guid MaterialId), OpenSupply>> OpenSupplyAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            List<InventoryLocation> scope,
            Dictionary<Guid, BuyerProperty> properties,
            Dictionary<Guid, ItemBuyerMaster> materials,
            Dictionary<Guid, List<MaterialUomConversion>> conversions,
            CancellationToken cancellationToken)
        {
            Dictionary<(Guid LocationId, Guid MaterialId), OpenSupply> result = new Dictionary<(Guid, Guid), OpenSupply>();
            List<PurchaseOrder> orders = await repository.PurchaseOrder
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive
                    && x.Status != SilaReceivingRules.PO_CANCELLED
                    && x.Status != Common.SILA_PO_RECEIVED)
                .ToListAsync(cancellationToken);
            if (orders.Count == 0)
            {
                return result;
            }

            List<Guid> poIds = orders.Select(x => x.Id).ToList();
            List<PurchaseOrderItem> items = await repository.PurchaseOrderItem
                .FindByCondition(x => poIds.Contains(x.PurchaseOrderId) && x.IsActive)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, PurchaseOrder> byPo = orders.ToDictionary(x => x.Id);
            Dictionary<string, ItemBuyerMaster> byCode = materials.Values
                .Where(x => !string.IsNullOrWhiteSpace(x.MaterialCode))
                .GroupBy(x => x.MaterialCode!.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

            foreach (PurchaseOrderItem item in items)
            {
                decimal open = SilaReceivingRules.OpenQuantity(item);
                if (open <= 0 || string.IsNullOrWhiteSpace(item.MaterialCode) || !byCode.TryGetValue(item.MaterialCode.Trim(), out ItemBuyerMaster? material))
                {
                    continue;
                }

                if (!byPo.TryGetValue(item.PurchaseOrderId, out PurchaseOrder? order))
                {
                    continue;
                }

                decimal? baseOpen = UomConverter.TryToBase(material, open, item.UnitOfMeasure, conversions);
                if (baseOpen == null)
                {
                    continue;
                }

                foreach (InventoryLocation location in scope.Where(location => Matches(order, item, location, properties)))
                {
                    (Guid LocationId, Guid MaterialId) key = (location.Id, material.Id);
                    if (!result.TryGetValue(key, out OpenSupply supply))
                    {
                        supply = new OpenSupply();
                        result[key] = supply;
                    }

                    supply.Qty += baseOpen.Value;
                    if (supply.UnitPrice == null && item.UnitPrice != null)
                    {
                        supply.UnitPrice = item.UnitPrice;
                        supply.Currency = item.Currency ?? order.Currency;
                        supply.SupplierId = order.SupplierId;
                        supply.SupplierName = order.SupplierName;
                    }
                    else if (supply.SupplierId == null)
                    {
                        supply.SupplierId = order.SupplierId;
                        supply.SupplierName = order.SupplierName;
                    }
                }
            }

            return result;
        }

        private static bool Matches(
            PurchaseOrder order, PurchaseOrderItem item, InventoryLocation location, Dictionary<Guid, BuyerProperty> properties)
        {
            if (item.OutletId != null && location.OutletId != null && item.OutletId == location.OutletId)
            {
                return true;
            }

            if (!string.IsNullOrWhiteSpace(item.StorageLocation) && !string.IsNullOrWhiteSpace(location.StorageLocationCode)
                && string.Equals(item.StorageLocation.Trim(), location.StorageLocationCode.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (string.IsNullOrWhiteSpace(item.StorageLocation) && item.OutletId == null
                && !string.IsNullOrWhiteSpace(order.PlantCode)
                && properties.TryGetValue(location.PropertyId, out BuyerProperty? property)
                && !string.IsNullOrWhiteSpace(property.PlantCode)
                && string.Equals(order.PlantCode.Trim(), property.PlantCode.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            return false;
        }

        private sealed class OpenSupply
        {
            public decimal Qty { get; set; }
            public Guid? SupplierId { get; set; }
            public string? SupplierName { get; set; }
            public decimal? UnitPrice { get; set; }
            public string? Currency { get; set; }
        }
    }
}
