using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Explanations of the inventory dashboard figures: a note and a configured flag per KPI and movement bucket, and the
    /// near-expiry state of the stock health. Runs after SilaDashboardFigures filled the numbers.
    /// </summary>
    public static class SilaDashboardNotes
    {
        public const string KPI_STOCK_VALUE = "STOCK_VALUE";
        public const string KPI_LOW_STOCK = "LOW_STOCK";
        public const string KPI_OUT_OF_STOCK = "OUT_OF_STOCK";
        public const string KPI_NEGATIVE_STOCK = "NEGATIVE_STOCK";
        public const string KPI_OPEN_TRANSFERS = "OPEN_TRANSFERS";
        public const string KPI_OPEN_COUNTS = "OPEN_COUNTS";
        public const string KPI_OPEN_ALERTS = "OPEN_ALERTS";
        private const string BUCKET_CONSUMED = "CONSUMED";

        public static async Task ApplyAsync(
            IRepositoryWrapper repository, Guid buyerId, List<InventoryLocation> scope, HashSet<Guid>? materialFilter,
            DateTime businessDate, SilaInventoryDashboardDto result, CancellationToken cancellationToken)
        {
            List<Guid> scopeIds = scope.Select(x => x.Id).ToList();
            List<Guid> stockedMaterialIds = await repository.InventoryBalance
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && scopeIds.Contains(x.LocationId) && x.OnHandQty > 0)
                .Select(x => x.MaterialId)
                .Distinct()
                .ToListAsync(cancellationToken);
            if (materialFilter != null)
            {
                stockedMaterialIds = stockedMaterialIds.Where(materialFilter.Contains).ToList();
            }

            List<(bool Costed, bool ExpiryManaged)> materials = (await repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyerId && stockedMaterialIds.Contains(x.Id))
                    .Select(x => new { Costed = x.UnitCost != null && x.UnitCost > 0, x.ExpiryManaged })
                    .ToListAsync(cancellationToken))
                .Select(x => (x.Costed, x.ExpiryManaged))
                .ToList();
            List<InventoryLocationMaterial> stocking = await repository.InventoryLocationMaterial
                .FindByCondition(x => x.IsActive && scopeIds.Contains(x.LocationId))
                .ToListAsync(cancellationToken);
            if (materialFilter != null)
            {
                stocking = stocking.Where(x => materialFilter.Contains(x.MaterialId)).ToList();
            }

            bool hasLevels = stocking.Any(x => x.ReorderPoint != null || x.MinimumStock != null);
            bool posConfigured = await repository.PosSource.FindByCondition(x => x.BuyerId == buyerId && x.IsActive).AnyAsync(cancellationToken);

            ApplyKpis(result, scope.Count, materials.Count(x => x.Costed), stocking.Count, hasLevels);
            ApplyExpiry(result.Health, materials.Count(x => x.ExpiryManaged));
            ApplyMovements(result, businessDate, posConfigured);
        }

        private static void ApplyKpis(SilaInventoryDashboardDto result, int locations, int costedMaterials, int stockingRows, bool hasLevels)
        {
            SilaDashboardKpisDto kpis = result.Kpis;
            List<SilaTransferStageDto> stages = result.TransferStages;
            int Stage(string status) => stages.Where(x => x.Status == status).Sum(x => x.Count);
            kpis.Notes = new List<SilaDashboardKpiNoteDto>
            {
                Note(KPI_STOCK_VALUE, costedMaterials > 0,
                    costedMaterials > 0 ? $"On hand × unit cost across {locations} location(s)" : "No unit cost on the materials in stock"),
                Note(KPI_LOW_STOCK, hasLevels,
                    hasLevels ? "At or under the reorder point (else minimum stock)" : "No reorder point or minimum stock set"),
                Note(KPI_OUT_OF_STOCK, stockingRows > 0,
                    stockingRows > 0 ? $"Nothing on hand of {stockingRows} stocked material line(s)" : "No materials assigned to the locations"),
                Note(KPI_NEGATIVE_STOCK, true, kpis.NegativeStock > 0 ? "Balances below zero: count or investigate" : "No balance below zero"),
                Note(KPI_OPEN_TRANSFERS, true,
                    $"{Stage(Common.SILA_ITO_PENDING_APPROVAL)} awaiting approval, {Stage(Common.SILA_ITO_DISPATCHED)} in transit"),
                Note(KPI_OPEN_COUNTS, true, "In progress, submitted or waiting for enquiries"),
                Note(KPI_OPEN_ALERTS, true, "New or acknowledged alerts")
            };
        }

        private static void ApplyExpiry(SilaStockHealthDto health, int expiryManagedInStock)
        {
            health.ExpiryManagedInStock = expiryManagedInStock;
            health.NearExpiryConfigured = expiryManagedInStock > 0;
            health.NearExpiryNote = expiryManagedInStock > 0
                ? $"{expiryManagedInStock} expiry-managed material(s) in stock: check their dates at the next count"
                : "No expiry-managed stock";
        }

        private static void ApplyMovements(SilaInventoryDashboardDto result, DateTime businessDate, bool posConfigured)
        {
            foreach (SilaMovementBucketDto bucket in result.MovementToday)
            {
                bucket.Configured = bucket.Key != BUCKET_CONSUMED || posConfigured || bucket.Count > 0;
                bucket.Note = !bucket.Configured
                    ? "No POS source set up"
                    : bucket.Count == 0 ? $"None on {businessDate:dd MMM}" : $"{bucket.Count} movement(s) on {businessDate:dd MMM}";
            }
        }

        private static SilaDashboardKpiNoteDto Note(string key, bool configured, string note)
        {
            return new SilaDashboardKpiNoteDto { Key = key, Configured = configured, Note = note };
        }
    }
}
