using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Live inventory figures beyond on hand: stock reserved by open transfers, the stock status against the stocking
    /// levels, whether the current location stocks the material, and the stocking-dependent next actions.
    /// </summary>
    public static class SilaLiveStockFigures
    {
        public const string ACTION_ADD_TO_LOCATION = "ADD_TO_LOCATION";
        public const string ACTION_ONE_TIME_TRANSFER = "ONE_TIME_TRANSFER";
        public const string ACTION_REDISTRIBUTE_STOCK = "REDISTRIBUTE_STOCK";
        public const string ACTION_REQUEST_ITEM = "REQUEST_ITEM";

        public const string STATUS_NEGATIVE = "NEGATIVE";
        public const string STATUS_IN_STOCK = "IN_STOCK";

        /// <summary>Quantity requested or approved on transfers out of each location that have not left yet.</summary>
        public static async Task<Dictionary<Guid, decimal>> GetReservedAsync(
            IRepositoryWrapper repository, Guid buyerId, Guid materialId, List<Guid> locationIds, CancellationToken cancellationToken)
        {
            Dictionary<Guid, Guid> openTransfers = await repository.InternalTransferOrder
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && locationIds.Contains(x.FromLocationId)
                    && (x.Status == Common.SILA_ITO_PENDING_APPROVAL || x.Status == Common.SILA_ITO_APPROVED))
                .ToDictionaryAsync(x => x.Id, x => x.FromLocationId, cancellationToken);
            if (openTransfers.Count == 0)
            {
                return new Dictionary<Guid, decimal>();
            }

            List<Guid> transferIds = openTransfers.Keys.ToList();
            List<InternalTransferOrderItem> items = await repository.InternalTransferOrderItem
                .FindByCondition(x => x.IsActive && x.MaterialId == materialId && transferIds.Contains(x.InternalTransferOrderId))
                .ToListAsync(cancellationToken);
            return items
                .GroupBy(x => openTransfers[x.InternalTransferOrderId])
                .ToDictionary(x => x.Key, x => x.Sum(item => item.ApprovedQty > 0 ? item.ApprovedQty : item.RequestedQty));
        }

        /// <summary>NEGATIVE below zero; without a stocking row IN_STOCK or OUT; else the health against the month's levels.</summary>
        public static string StockStatus(
            decimal onHand,
            InventoryLocationMaterial? row,
            Dictionary<(Guid LocationMaterialId, int Month), LocationMaterialThreshold> thresholds,
            int month)
        {
            if (onHand < 0)
            {
                return STATUS_NEGATIVE;
            }

            if (row == null)
            {
                return onHand > 0 ? STATUS_IN_STOCK : SilaStockLevels.HEALTH_OUT;
            }

            return SilaStockLevels.Classify(onHand, SilaStockLevels.Effective(row, thresholds, month));
        }

        /// <summary>
        /// Stocking state of the current location, the transferable basis of every row, and the next actions that depend on
        /// stocking: a location that does not stock the material adds it (ADD_TO_LOCATION), takes it once (ONE_TIME_TRANSFER)
        /// or requests it (REQUEST_ITEM); a location with spare stock can redistribute to a location under its minimum.
        /// </summary>
        public static void ApplyStocking(
            SilaLiveInventoryDetailDto result, Dictionary<Guid, InventoryLocationMaterial> stockingRows, bool quickTransferEnabled)
        {
            Guid? currentId = result.CurrentLocationId;
            foreach (SilaLiveInventoryLocationDto row in result.Locations)
            {
                row.TransferableBasis = Basis(row, currentId);
            }

            if (currentId == null)
            {
                return;
            }

            string localStatus = SilaLocationStocking.StatusOf(stockingRows.GetValueOrDefault(currentId.Value));
            result.LocalStockingStatus = localStatus;
            result.NotStockedAtLocation = localStatus != SilaLocationStocking.STATUS_ACTIVE;

            List<string> actions = result.NextActions;
            if (result.NotStockedAtLocation)
            {
                bool canTransfer = actions.Remove(SilaLiveRecommendation.ACTION_REQUEST_TRANSFER);
                actions.Remove(SilaLiveRecommendation.ACTION_QUICK_TRANSFER);
                int index = actions.Contains(SilaLiveRecommendation.ACTION_REQUEST_PHYSICAL_INVENTORY) ? 1 : 0;
                if (canTransfer)
                {
                    actions.Insert(index, ACTION_ADD_TO_LOCATION);
                    if (quickTransferEnabled)
                    {
                        actions.Insert(index + 1, ACTION_ONE_TIME_TRANSFER);
                    }
                }

                int pr = actions.IndexOf(SilaLiveRecommendation.ACTION_CREATE_PR);
                if (pr >= 0)
                {
                    actions[pr] = ACTION_REQUEST_ITEM;
                }
            }

            ApplyRedistribution(result, currentId.Value);
        }

        private static void ApplyRedistribution(SilaLiveInventoryDetailDto result, Guid currentId)
        {
            SilaLiveInventoryLocationDto? current = result.Locations.FirstOrDefault(x => x.LocationId == currentId);
            if (current == null || !current.TransferEnabled || result.Shortage > 0)
            {
                return;
            }

            decimal spare = current.AvailableQty - result.RequiredQty;
            SilaLiveInventoryLocationDto? target = result.Locations
                .Where(x => x.LocationId != currentId
                    && x.PropertyId == current.PropertyId
                    && x.LocationType != Common.SILA_LOCATION_VENUE
                    && x.TransferEnabled
                    && x.StockingStatus == SilaLocationStocking.STATUS_ACTIVE
                    && x.MinimumStock != null
                    && x.OnHandQty < x.MinimumStock.Value)
                .OrderBy(x => x.OnHandQty - x.MinimumStock!.Value)
                .FirstOrDefault();
            if (spare <= 0 || target == null)
            {
                return;
            }

            result.RedistributeToLocationId = target.LocationId;
            result.RedistributeToName = target.LocationName;
            result.RedistributeQty = Math.Min(spare, target.MinimumStock!.Value - Math.Max(0, target.OnHandQty));
            result.NextActions.Add(ACTION_REDISTRIBUTE_STOCK);
        }

        private static string Basis(SilaLiveInventoryLocationDto row, Guid? currentId)
        {
            if (row.LocationId == currentId)
            {
                return "Current location";
            }

            if (row.LocationType == Common.SILA_LOCATION_VENUE)
            {
                return "Venues hold no stock";
            }

            if (!row.TransferEnabled)
            {
                return "Transfers disabled";
            }

            if (row.AvailableQty <= 0)
            {
                return row.ReservedQty > 0 ? "Reserved by open transfers" : "No available stock";
            }

            return row.ReservedQty > 0 ? "Available after open transfers" : "Available stock";
        }
    }
}
