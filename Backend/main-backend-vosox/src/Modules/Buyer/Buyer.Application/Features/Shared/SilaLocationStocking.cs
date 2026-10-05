using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Stocking rows (material assigned to a location) created on the fly, e.g. "Add to location" in Live Inventory.</summary>
    public static class SilaLocationStocking
    {
        public const string TYPE_REGULAR = "REGULAR";
        public const string TYPE_ON_DEMAND = "ON_DEMAND";
        public static readonly string[] StockingTypes = { TYPE_REGULAR, TYPE_ON_DEMAND };

        public const string STATUS_ACTIVE = "ACTIVE";
        public const string STATUS_INACTIVE = "INACTIVE";
        public const string STATUS_NOT_STOCKED = "NOT_STOCKED";

        /// <summary>
        /// Assigns the materials to the location: a missing row is created (REGULAR, no levels), an inactive one is
        /// reactivated. Returns the number of rows created or reactivated. The caller saves.
        /// </summary>
        public static async Task<int> EnsureStockedAsync(
            IRepositoryWrapper repository, Guid locationId, IEnumerable<Guid> materialIds, CancellationToken cancellationToken)
        {
            List<Guid> ids = materialIds.Distinct().ToList();
            Dictionary<Guid, InventoryLocationMaterial> existing = (await repository.InventoryLocationMaterial
                    .FindByCondition(x => x.LocationId == locationId && ids.Contains(x.MaterialId))
                    .ToListAsync(cancellationToken))
                .GroupBy(x => x.MaterialId)
                .ToDictionary(x => x.Key, x => x.OrderByDescending(row => row.IsActive).First());
            int changed = 0;
            foreach (Guid materialId in ids)
            {
                if (existing.TryGetValue(materialId, out InventoryLocationMaterial? row))
                {
                    if (!row.IsActive)
                    {
                        row.IsActive = true;
                        repository.InventoryLocationMaterial.Update(row);
                        changed++;
                    }

                    continue;
                }

                repository.InventoryLocationMaterial.Create(new InventoryLocationMaterial
                {
                    Id = Guid.NewGuid(),
                    LocationId = locationId,
                    MaterialId = materialId,
                    StockingType = TYPE_REGULAR,
                    IsActive = true
                });
                changed++;
            }

            return changed;
        }

        /// <summary>ACTIVE / INACTIVE for a stocking row, NOT_STOCKED without one.</summary>
        public static string StatusOf(InventoryLocationMaterial? row)
        {
            return row == null ? STATUS_NOT_STOCKED : row.IsActive ? STATUS_ACTIVE : STATUS_INACTIVE;
        }
    }
}
