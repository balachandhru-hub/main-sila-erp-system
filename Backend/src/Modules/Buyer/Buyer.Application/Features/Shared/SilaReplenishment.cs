using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The replenishment list and stock health of the inventory dashboard. Every active stocking row of the locations in
    /// scope is classified with the current month's levels (LocationMaterialThreshold override, else the base level). A row at
    /// or under its threshold gets a recommended quantity (par level − available) and, as source, the location of the same
    /// property with the most transferable stock (CREATE_TRANSFER); without such a source the action is CREATE_PR.
    /// </summary>
    public static class SilaReplenishment
    {
        public const string ACTION_CREATE_TRANSFER = "CREATE_TRANSFER";
        public const string ACTION_CREATE_PR = "CREATE_PR";

        public const string STATUS_PR_OPEN = "PR_OPEN";

        private const int MAX_ROWS = 200;

        public static async Task<(List<SilaReplenishmentRowDto> Rows, SilaStockHealthDto Health)> BuildAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            List<InventoryLocation> scope,
            HashSet<Guid>? materialFilter,
            int month,
            CancellationToken cancellationToken)
        {
            List<Guid> scopeIds = scope.Select(x => x.Id).ToList();
            List<InventoryLocationMaterial> stocking = await repository.InventoryLocationMaterial
                .FindByCondition(x => x.IsActive && scopeIds.Contains(x.LocationId))
                .ToListAsync(cancellationToken);
            if (materialFilter != null)
            {
                stocking = stocking.Where(x => materialFilter.Contains(x.MaterialId)).ToList();
            }

            SilaStockHealthDto health = new SilaStockHealthDto();
            List<SilaReplenishmentRowDto> rows = new List<SilaReplenishmentRowDto>();
            if (stocking.Count == 0)
            {
                return (rows, health);
            }

            List<Guid> materialIds = stocking.Select(x => x.MaterialId).Distinct().ToList();
            List<Guid> propertyIds = scope.Select(x => x.PropertyId).Distinct().ToList();
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
            Dictionary<Guid, ItemBuyerMaster> materials = await repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<(Guid LocationMaterialId, int Month), LocationMaterialThreshold> thresholds = await SilaStockLevels.GetThresholdsAsync(
                repository, stocking.Select(x => x.Id).ToList(), month, cancellationToken);
            Dictionary<(Guid LocationId, Guid MaterialId), string> openRequests = (await repository.InternalPurchaseRequest
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == Common.SILA_PR_SUBMITTED
                        && scopeIds.Contains(x.LocationId) && materialIds.Contains(x.MaterialId))
                    .Select(x => new { x.LocationId, x.MaterialId, x.RequestNumber })
                    .ToListAsync(cancellationToken))
                .GroupBy(x => (x.LocationId, x.MaterialId))
                .ToDictionary(x => x.Key, x => x.First().RequestNumber);
            Dictionary<Guid, InventoryLocation> locations = scope.ToDictionary(x => x.Id);

            foreach (InventoryLocationMaterial row in stocking)
            {
                if (!materials.TryGetValue(row.MaterialId, out ItemBuyerMaster? material) || !locations.TryGetValue(row.LocationId, out InventoryLocation? destination))
                {
                    continue;
                }

                decimal available = onHand.TryGetValue((row.LocationId, row.MaterialId), out decimal quantity) ? quantity : 0;
                SilaEffectiveLevels levels = SilaStockLevels.Effective(row, thresholds, month);
                string status = SilaStockLevels.Classify(available, levels);
                Count(health, status);
                decimal? recommended = SilaStockLevels.RecommendedQuantity(available, levels);
                if (recommended == null)
                {
                    continue;
                }

                (InventoryLocation? source, decimal transferable) = BestSource(propertyLocations, onHand, destination, row.MaterialId);
                bool transfer = source != null && destination.TransferEnabled;
                rows.Add(new SilaReplenishmentRowDto
                {
                    MaterialId = material.Id,
                    MaterialCode = material.MaterialCode ?? string.Empty,
                    MaterialName = material.Description ?? material.MaterialCode ?? string.Empty,
                    Uom = UomConverter.BaseUomOf(material),
                    DestinationLocationId = destination.Id,
                    DestinationName = destination.LocationName,
                    AvailableQty = available,
                    ReorderPoint = levels.ReorderPoint,
                    MinimumStock = levels.MinimumStock,
                    ParLevel = levels.ParLevel,
                    RecommendedQty = recommended.Value,
                    SourceLocationId = source?.Id,
                    SourceName = source?.LocationName,
                    SourceTransferableQty = source == null ? null : transferable,
                    Action = transfer ? ACTION_CREATE_TRANSFER : ACTION_CREATE_PR,
                    OpenPurchaseRequestNumber = openRequests.TryGetValue((destination.Id, material.Id), out string? number) ? number : null,
                    Status = number != null ? STATUS_PR_OPEN : status
                });
            }

            List<SilaReplenishmentRowDto> ordered = rows
                .OrderBy(x => x.AvailableQty <= 0 ? 0 : 1)
                .ThenBy(x => x.DestinationName)
                .ThenBy(x => x.MaterialName)
                .Take(MAX_ROWS)
                .ToList();
            return (ordered, health);
        }

        /// <summary>The other transfer-enabled store or outlet of the destination's property holding the most stock of the material.</summary>
        public static (InventoryLocation? Source, decimal Transferable) BestSource(
            List<InventoryLocation> propertyLocations,
            Dictionary<(Guid LocationId, Guid MaterialId), decimal> onHand,
            InventoryLocation destination,
            Guid materialId)
        {
            InventoryLocation? best = null;
            decimal bestQuantity = 0;
            foreach (InventoryLocation candidate in propertyLocations)
            {
                if (candidate.Id == destination.Id || candidate.PropertyId != destination.PropertyId || candidate.LocationType == Common.SILA_LOCATION_VENUE)
                {
                    continue;
                }

                decimal stock = onHand.TryGetValue((candidate.Id, materialId), out decimal quantity) ? quantity : 0;
                decimal transferable = SilaStockLevels.Transferable(candidate, stock);
                if (transferable > bestQuantity)
                {
                    best = candidate;
                    bestQuantity = transferable;
                }
            }

            return (best, bestQuantity);
        }

        private static void Count(SilaStockHealthDto health, string status)
        {
            switch (status)
            {
                case SilaStockLevels.HEALTH_OUT:
                    health.Out++;
                    break;
                case SilaStockLevels.HEALTH_LOW:
                    health.Low++;
                    break;
                case SilaStockLevels.HEALTH_EXCESS:
                    health.Excess++;
                    break;
                default:
                    health.Healthy++;
                    break;
            }
        }
    }
}
