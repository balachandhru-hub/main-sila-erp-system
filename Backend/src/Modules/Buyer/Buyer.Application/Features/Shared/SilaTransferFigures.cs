using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Display figures of internal transfer orders: the location relationship, unit costs and values, and the stock at
    /// the source. Every lookup is one batched query per call.
    /// </summary>
    public static class SilaTransferFigures
    {
        /// <summary>Unit costs and on-hand quantities by (location, material), and the material cost/currency by material.</summary>
        public class CostBook
        {
            public Dictionary<(Guid LocationId, Guid MaterialId), InventoryBalance> Balances { get; } = new();
            public Dictionary<Guid, (decimal? UnitCost, string? Currency)> Materials { get; } = new();

            public decimal? UnitCost(Guid locationId, Guid materialId)
            {
                decimal? balanceCost = Balances.TryGetValue((locationId, materialId), out InventoryBalance? balance) ? balance.UnitCost : null;
                return balanceCost ?? (Materials.TryGetValue(materialId, out (decimal? UnitCost, string? Currency) material) ? material.UnitCost : null);
            }

            public decimal OnHand(Guid locationId, Guid materialId)
            {
                return Balances.TryGetValue((locationId, materialId), out InventoryBalance? balance) ? balance.OnHandQty : 0;
            }

            /// <summary>The one currency of the materials, or null when they differ or none is set.</summary>
            public string? CurrencyOf(IEnumerable<Guid> materialIds)
            {
                List<string> currencies = materialIds
                    .Select(x => Materials.TryGetValue(x, out (decimal? UnitCost, string? Currency) m) ? m.Currency : null)
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x!)
                    .Distinct()
                    .ToList();
                return currencies.Count == 1 ? currencies[0] : null;
            }
        }

        /// <summary>STORE_TO_OUTLET style relationship of two location types.</summary>
        public static string? Relationship(string? fromType, string? toType)
        {
            if (string.IsNullOrWhiteSpace(fromType) || string.IsNullOrWhiteSpace(toType))
            {
                return null;
            }

            return $"{fromType.Trim().ToUpperInvariant()}_TO_{toType.Trim().ToUpperInvariant()}";
        }

        /// <summary>The quantity that best describes the line now: received, else dispatched, else approved, else requested.</summary>
        public static decimal EffectiveQty(InternalTransferOrderItem item)
        {
            if (item.ReceivedQty > 0)
            {
                return item.ReceivedQty;
            }

            if (item.DispatchedQty > 0)
            {
                return item.DispatchedQty;
            }

            return item.ApprovedQty > 0 ? item.ApprovedQty : item.RequestedQty;
        }

        /// <summary>True while the stock has not left the source yet.</summary>
        public static bool BeforeDispatch(InternalTransferOrder transfer)
        {
            return transfer.Status == Common.SILA_ITO_PENDING_APPROVAL || transfer.Status == Common.SILA_ITO_APPROVED;
        }

        public static async Task<CostBook> GetCostBookAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            IEnumerable<Guid> locationIds,
            IEnumerable<Guid> materialIds,
            CancellationToken cancellationToken)
        {
            List<Guid> locations = locationIds.Distinct().ToList();
            List<Guid> materials = materialIds.Distinct().ToList();
            CostBook book = new CostBook();
            if (materials.Count == 0)
            {
                return book;
            }

            List<InventoryBalance> balances = await repository.InventoryBalance
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && locations.Contains(x.LocationId) && materials.Contains(x.MaterialId))
                .ToListAsync(cancellationToken);
            foreach (InventoryBalance balance in balances)
            {
                book.Balances[(balance.LocationId, balance.MaterialId)] = balance;
            }

            Dictionary<Guid, (decimal? UnitCost, string? Currency)> costs = (await repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyerId && materials.Contains(x.Id))
                    .Select(x => new { x.Id, x.UnitCost, x.Currency })
                    .ToListAsync(cancellationToken))
                .ToDictionary(x => x.Id, x => (x.UnitCost, x.Currency));
            foreach (KeyValuePair<Guid, (decimal? UnitCost, string? Currency)> cost in costs)
            {
                book.Materials[cost.Key] = cost.Value;
            }

            return book;
        }

        /// <summary>Total value of each transfer (null when no line has a cost) and its currency.</summary>
        public static Dictionary<Guid, (decimal? Value, string? Currency)> Totals(
            IEnumerable<InternalTransferOrder> transfers, List<InternalTransferOrderItem> items, CostBook book)
        {
            Dictionary<Guid, InternalTransferOrder> byId = transfers.ToDictionary(x => x.Id);
            return items
                .Where(x => byId.ContainsKey(x.InternalTransferOrderId))
                .GroupBy(x => x.InternalTransferOrderId)
                .ToDictionary(group => group.Key, group =>
                {
                    InternalTransferOrder transfer = byId[group.Key];
                    List<decimal> values = group
                        .Select(x => book.UnitCost(transfer.FromLocationId, x.MaterialId) * EffectiveQty(x))
                        .Where(x => x != null)
                        .Select(x => x!.Value)
                        .ToList();
                    decimal? total = values.Count == 0 ? null : Math.Round(values.Sum(), 2);
                    return (total, book.CurrencyOf(group.Select(x => x.MaterialId)));
                });
        }
    }
}
