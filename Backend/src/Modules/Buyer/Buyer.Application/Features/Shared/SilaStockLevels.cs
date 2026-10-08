using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Stocking-level rules of the inventory control screens and the low-stock job: the month overrides
    /// (LocationMaterialThreshold), the stock health of a balance and the recommended replenishment quantity.
    /// </summary>
    public static class SilaStockLevels
    {
        public const string HEALTH_HEALTHY = "HEALTHY";
        public const string HEALTH_LOW = "LOW";
        public const string HEALTH_OUT = "OUT";
        public const string HEALTH_EXCESS = "EXCESS";

        /// <summary>The active month overrides of the stocking rows, keyed by (stocking row id, month).</summary>
        public static async Task<Dictionary<(Guid LocationMaterialId, int Month), LocationMaterialThreshold>> GetThresholdsAsync(
            IRepositoryWrapper repository, ICollection<Guid> locationMaterialIds, int? month, CancellationToken cancellationToken)
        {
            if (locationMaterialIds.Count == 0)
            {
                return new Dictionary<(Guid, int), LocationMaterialThreshold>();
            }

            IQueryable<LocationMaterialThreshold> query = repository.LocationMaterialThreshold
                .FindByCondition(x => x.IsActive && locationMaterialIds.Contains(x.LocationMaterialId));
            if (month != null)
            {
                int value = month.Value;
                query = query.Where(x => x.Month == value);
            }

            List<LocationMaterialThreshold> rows = await query.ToListAsync(cancellationToken);
            return rows
                .GroupBy(x => (x.LocationMaterialId, x.Month))
                .ToDictionary(x => x.Key, x => x.First());
        }

        /// <summary>The levels of the stocking row for the month: the month override where it sets a value, else the base level.</summary>
        public static SilaEffectiveLevels Effective(
            InventoryLocationMaterial row, Dictionary<(Guid LocationMaterialId, int Month), LocationMaterialThreshold> thresholds, int month)
        {
            thresholds.TryGetValue((row.Id, month), out LocationMaterialThreshold? overrideRow);
            return new SilaEffectiveLevels
            {
                MinimumStock = overrideRow?.MinimumStock ?? row.MinimumStock,
                ReorderPoint = overrideRow?.ReorderPoint ?? row.ReorderPoint,
                ParLevel = row.ParLevel
            };
        }

        /// <summary>OUT at zero or less, LOW at or under the threshold, EXCESS above the par level, else HEALTHY.</summary>
        public static string Classify(decimal available, SilaEffectiveLevels levels)
        {
            if (available <= 0)
            {
                return HEALTH_OUT;
            }

            if (levels.Threshold != null && available <= levels.Threshold.Value)
            {
                return HEALTH_LOW;
            }

            if (levels.ParLevel != null && levels.ParLevel.Value > 0 && available > levels.ParLevel.Value)
            {
                return HEALTH_EXCESS;
            }

            return HEALTH_HEALTHY;
        }

        /// <summary>
        /// The quantity that brings the location back to its par level when it is at or under its threshold; without a par
        /// level, back to the threshold. Null when no replenishment is needed.
        /// </summary>
        public static decimal? RecommendedQuantity(decimal available, SilaEffectiveLevels levels)
        {
            if (levels.Threshold == null || available > levels.Threshold.Value)
            {
                return null;
            }

            decimal target = levels.ParLevel ?? levels.Threshold.Value;
            decimal quantity = target - Math.Max(0, available);
            return quantity > 0 ? quantity : null;
        }

        /// <summary>Stock a location can give away: its on hand quantity when transfers are enabled, never below zero.</summary>
        public static decimal Transferable(InventoryLocation location, decimal onHand)
        {
            return location.TransferEnabled ? Math.Max(0, onHand) : 0;
        }
    }
}
