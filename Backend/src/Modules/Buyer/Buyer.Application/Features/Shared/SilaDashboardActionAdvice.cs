using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Impact, recommendation and primary action of each action-center alert: stock alerts get the stock on hand, the par
    /// level and the best source of the same property (transfer when it has stock, else a purchase request); other alerts
    /// are investigated. One batched query per table.
    /// </summary>
    public static class SilaDashboardActionAdvice
    {
        public const string ACTION_INVESTIGATE = "INVESTIGATE";

        public static async Task ApplyAsync(
            IRepositoryWrapper repository, Guid buyerId, int month, SilaInventoryDashboardDto result, CancellationToken cancellationToken)
        {
            List<SilaDashboardActionDto> actions = result.Actions;
            foreach (SilaDashboardActionDto action in actions)
            {
                action.KindLabel = Label(action.AlertType);
                action.PrimaryAction = ACTION_INVESTIGATE;
                action.Recommendation = action.RecommendedAction == null ? "Investigate the alert" : Label(action.RecommendedAction);
            }

            List<SilaDashboardActionDto> stockActions = actions
                .Where(x => x.LocationId != null && x.MaterialId != null
                    && (x.AlertType == Common.SILA_ALERT_LOW_STOCK || x.AlertType == Common.SILA_ALERT_NEGATIVE_STOCK))
                .ToList();
            if (stockActions.Count == 0)
            {
                return;
            }

            List<Guid> locationIds = stockActions.Select(x => x.LocationId!.Value).Distinct().ToList();
            List<Guid> materialIds = stockActions.Select(x => x.MaterialId!.Value).Distinct().ToList();
            List<InventoryLocation> alertLocations = await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && locationIds.Contains(x.Id))
                .ToListAsync(cancellationToken);
            List<Guid> propertyIds = alertLocations.Select(x => x.PropertyId).Distinct().ToList();
            List<InventoryLocation> propertyLocations = await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && propertyIds.Contains(x.PropertyId))
                .ToListAsync(cancellationToken);
            List<Guid> propertyLocationIds = propertyLocations.Select(x => x.Id).ToList();
            Dictionary<(Guid LocationId, Guid MaterialId), decimal> onHand = (await repository.InventoryBalance
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && materialIds.Contains(x.MaterialId) && propertyLocationIds.Contains(x.LocationId))
                    .Select(x => new { x.LocationId, x.MaterialId, x.OnHandQty })
                    .ToListAsync(cancellationToken))
                .GroupBy(x => (x.LocationId, x.MaterialId))
                .ToDictionary(x => x.Key, x => x.Sum(row => row.OnHandQty));
            List<InventoryLocationMaterial> stocking = await repository.InventoryLocationMaterial
                .FindByCondition(x => x.IsActive && locationIds.Contains(x.LocationId) && materialIds.Contains(x.MaterialId))
                .ToListAsync(cancellationToken);
            Dictionary<(Guid LocationMaterialId, int Month), LocationMaterialThreshold> thresholds = await SilaStockLevels.GetThresholdsAsync(
                repository, stocking.Select(x => x.Id).ToList(), month, cancellationToken);
            Dictionary<Guid, string> uoms = (await repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyerId && materialIds.Contains(x.Id))
                    .ToListAsync(cancellationToken))
                .ToDictionary(x => x.Id, x => UomConverter.BaseUomOf(x));
            Dictionary<Guid, InventoryLocation> byId = alertLocations.ToDictionary(x => x.Id);

            foreach (SilaDashboardActionDto action in stockActions)
            {
                Guid locationId = action.LocationId!.Value;
                Guid materialId = action.MaterialId!.Value;
                if (!byId.TryGetValue(locationId, out InventoryLocation? destination))
                {
                    continue;
                }

                InventoryLocationMaterial? row = stocking.FirstOrDefault(x => x.LocationId == locationId && x.MaterialId == materialId);
                SilaEffectiveLevels? levels = row == null ? null : SilaStockLevels.Effective(row, thresholds, month);
                decimal available = onHand.TryGetValue((locationId, materialId), out decimal quantity) ? quantity : 0;
                string uom = uoms.GetValueOrDefault(materialId) ?? string.Empty;
                (InventoryLocation? source, decimal transferable) = SilaReplenishment.BestSource(propertyLocations, onHand, destination, materialId);
                decimal needed = levels == null ? 0 : SilaStockLevels.RecommendedQuantity(available, levels) ?? 0;

                action.AvailableQty = available;
                action.ParLevel = levels?.ParLevel;
                action.Uom = uom;
                action.SourceLocationId = source?.Id;
                action.SourceLocationName = source?.LocationName;
                action.SourceAvailable = source == null ? null : transferable;
                action.Impact = levels?.ParLevel != null
                    ? $"{Qty(available)} {uom} on hand, par level {Qty(levels.ParLevel.Value)} {uom}"
                    : $"{Qty(available)} {uom} on hand";
                if (source != null && destination.TransferEnabled)
                {
                    decimal move = needed > 0 ? Math.Min(needed, transferable) : transferable;
                    action.PrimaryAction = SilaReplenishment.ACTION_CREATE_TRANSFER;
                    action.RecommendedQty = move;
                    action.Recommendation = $"Transfer {Qty(move)} {uom} from {source.LocationName}";
                }
                else
                {
                    action.PrimaryAction = SilaReplenishment.ACTION_CREATE_PR;
                    action.RecommendedQty = needed > 0 ? needed : null;
                    action.Recommendation = needed > 0
                        ? $"Raise a purchase request for {Qty(needed)} {uom}: no location of the property can spare stock"
                        : "Raise a purchase request: no location of the property can spare stock";
                }
            }
        }

        private static string Qty(decimal value)
        {
            return value.ToString("0.####", CultureInfo.InvariantCulture);
        }

        /// <summary>LOW_STOCK → "Low stock".</summary>
        private static string Label(string code)
        {
            if (string.IsNullOrWhiteSpace(code))
            {
                return string.Empty;
            }

            string text = code.Replace('_', ' ').ToLowerInvariant();
            return char.ToUpperInvariant(text[0]) + text.Substring(1);
        }
    }
}
