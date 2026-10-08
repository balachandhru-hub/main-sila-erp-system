using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The live inventory decision for one material at the caller's current location: what the location has, the shortage
    /// against the required quantity, what other locations of the same property can transfer, and the next actions.
    /// Internal stock is preferred before procurement: a purchase request is only proposed when the property cannot cover it.
    /// </summary>
    public static class SilaLiveRecommendation
    {
        public const string ACTION_REQUEST_TRANSFER = "REQUEST_TRANSFER";
        public const string ACTION_QUICK_TRANSFER = "QUICK_TRANSFER";
        public const string ACTION_CREATE_PR = "CREATE_PR";
        public const string ACTION_REQUEST_PHYSICAL_INVENTORY = "REQUEST_PHYSICAL_INVENTORY";

        public const string SUFFICIENT = "SUFFICIENT";
        public const string NO_LOCATION = "NO_LOCATION";

        public static void Apply(
            SilaLiveInventoryDetailDto result, List<InventoryLocation> locations, Guid? currentLocationId, decimal required, bool quickTransferEnabled)
        {
            result.RequiredQty = required;
            Dictionary<Guid, InventoryLocation> byId = locations.ToDictionary(x => x.Id);
            SilaLiveInventoryLocationDto? current = currentLocationId != null
                ? result.Locations.FirstOrDefault(x => x.LocationId == currentLocationId)
                : result.Locations.FirstOrDefault(x => x.IsMine && x.LocationType != Common.SILA_LOCATION_VENUE);
            if (current == null && currentLocationId != null && byId.TryGetValue(currentLocationId.Value, out InventoryLocation? chosen))
            {
                current = new SilaLiveInventoryLocationDto
                {
                    LocationId = chosen.Id,
                    LocationCode = chosen.LocationCode,
                    LocationName = chosen.LocationName,
                    LocationType = chosen.LocationType,
                    PropertyId = chosen.PropertyId,
                    TransferEnabled = chosen.TransferEnabled,
                    IsMine = true
                };
            }

            if (current == null)
            {
                result.Recommendation = NO_LOCATION;
                result.RecommendationReason = "Select the location the stock is needed at.";
                return;
            }

            result.CurrentLocationId = current.LocationId;
            result.LocalAvailable = current.OnHandQty;
            result.Shortage = Math.Max(0, required - Math.Max(0, current.OnHandQty));

            foreach (SilaLiveInventoryLocationDto row in result.Locations)
            {
                bool candidate = row.LocationId != current.LocationId
                    && row.PropertyId == current.PropertyId
                    && row.LocationType != Common.SILA_LOCATION_VENUE
                    && byId.ContainsKey(row.LocationId);
                row.TransferableQty = candidate ? SilaStockLevels.Transferable(byId[row.LocationId], row.AvailableQty) : 0;
            }

            SilaLiveInventoryLocationDto? best = result.Locations
                .Where(x => x.TransferableQty > 0)
                .OrderByDescending(x => x.TransferableQty)
                .FirstOrDefault();
            decimal internalStock = result.Locations.Sum(x => x.TransferableQty);
            bool canReceive = current.TransferEnabled && current.LocationType != Common.SILA_LOCATION_VENUE;
            if (best != null)
            {
                result.BestSourceLocationId = best.LocationId;
                result.BestSourceName = best.LocationName;
                result.BestSourceTransferableQty = best.TransferableQty;
            }

            List<string> actions = new List<string>();
            if (best != null && canReceive)
            {
                actions.Add(ACTION_REQUEST_TRANSFER);
                if (quickTransferEnabled)
                {
                    actions.Add(ACTION_QUICK_TRANSFER);
                }
            }

            bool propertyCovers = canReceive && internalStock > 0 && internalStock >= result.Shortage;
            if (!propertyCovers)
            {
                actions.Add(ACTION_CREATE_PR);
            }

            if (current.OnHandQty < 0)
            {
                actions.Insert(0, ACTION_REQUEST_PHYSICAL_INVENTORY);
            }

            result.NextActions = actions;
            if (result.Shortage <= 0)
            {
                result.Recommendation = SUFFICIENT;
                result.RecommendationReason = $"{current.LocationName} covers the required quantity.";
            }
            else if (propertyCovers)
            {
                result.Recommendation = ACTION_REQUEST_TRANSFER;
                result.RecommendationReason = $"Transfer from {best!.LocationName}: internal stock is used before purchasing.";
            }
            else
            {
                result.Recommendation = ACTION_CREATE_PR;
                result.RecommendationReason = "No location of the property can cover the shortage. Raise a purchase request.";
            }
        }
    }
}
