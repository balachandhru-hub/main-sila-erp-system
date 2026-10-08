using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The aggregated figures of the inventory dashboard, each computed in the database for the locations in scope:
    /// stock value per location, today's movements, transfer stages, open counts and alerts, and top consumption.
    /// </summary>
    public static class SilaDashboardFigures
    {
        private const int TOP_LOCATIONS = 10;
        private const int TOP_CONSUMPTION = 8;
        private const int TOP_ACTIONS = 10;

        private static readonly (string Key, string Label, string[] Types)[] MovementBuckets =
        {
            ("RECEIVED", "Received", new[] { Common.SILA_TXN_GOODS_RECEIPT, Common.SILA_TXN_OPENING_STOCK, Common.SILA_TXN_GOODS_ISSUE_IN }),
            ("CONSUMED", "Consumed", new[] { Common.SILA_TXN_RECIPE_CONSUMPTION, Common.SILA_TXN_GOODS_ISSUE_OUT }),
            ("TRANSFER_OUT", "Transferred out", new[] { Common.SILA_TXN_TRANSFER_OUT }),
            ("TRANSFER_IN", "Transferred in", new[] { Common.SILA_TXN_TRANSFER_IN }),
            ("WASTE", "Waste / damage", new[] { "WASTE", "DAMAGE", "BREAKAGE", "SPOILAGE", "EXPIRED" }),
            ("ADJUSTMENTS", "Adjustments", new[] { Common.SILA_TXN_STOCK_COUNT_ADJUSTMENT, Common.SILA_TXN_MANUAL_ADJUSTMENT })
        };

        private static readonly string[] OpenTransferStatuses =
        {
            Common.SILA_ITO_PENDING_APPROVAL, Common.SILA_ITO_APPROVED, Common.SILA_ITO_DISPATCHED, Common.SILA_ITO_DISCREPANCY
        };

        /// <summary>Stock value, negative balances, value per location and the shared currency of the balances in scope.</summary>
        public static async Task ApplyStockAsync(
            IRepositoryWrapper repository, Guid buyerId, List<InventoryLocation> scope, HashSet<Guid>? materialFilter,
            SilaInventoryDashboardDto result, CancellationToken cancellationToken)
        {
            List<Guid> scopeIds = scope.Select(x => x.Id).ToList();
            List<BalanceRow> balances = await repository.InventoryBalance
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && scopeIds.Contains(x.LocationId))
                .Select(x => new BalanceRow { LocationId = x.LocationId, MaterialId = x.MaterialId, OnHandQty = x.OnHandQty, UnitCost = x.UnitCost })
                .ToListAsync(cancellationToken);
            if (materialFilter != null)
            {
                balances = balances.Where(x => materialFilter.Contains(x.MaterialId)).ToList();
            }

            List<Guid> materialIds = balances.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, (decimal? UnitCost, string? Currency)> materials = (await repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyerId && materialIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.UnitCost, x.Currency })
                    .ToListAsync(cancellationToken))
                .ToDictionary(x => x.Id, x => (x.UnitCost, x.Currency));

            Dictionary<Guid, decimal> values = new Dictionary<Guid, decimal>();
            foreach (BalanceRow balance in balances)
            {
                decimal unitCost = balance.UnitCost ?? (materials.TryGetValue(balance.MaterialId, out (decimal? UnitCost, string? Currency) m) ? m.UnitCost ?? 0 : 0);
                decimal value = Math.Max(0, balance.OnHandQty) * unitCost;
                values[balance.LocationId] = (values.TryGetValue(balance.LocationId, out decimal sum) ? sum : 0) + value;
            }

            List<string> currencies = materials.Values.Select(x => x.Currency).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!).Distinct().ToList();
            result.Currency = currencies.Count == 1 ? currencies[0] : null;
            result.Kpis.StockValue = values.Values.Sum();
            result.Kpis.NegativeStock = balances.Count(x => x.OnHandQty < 0);
            decimal total = result.Kpis.StockValue;
            result.ValueByLocation = scope
                .Where(x => values.ContainsKey(x.Id))
                .Select(x => new SilaLocationValueDto
                {
                    LocationId = x.Id,
                    LocationCode = x.LocationCode,
                    LocationName = x.LocationName,
                    LocationType = x.LocationType,
                    Value = values[x.Id],
                    SharePercent = total == 0 ? 0 : Math.Round(values[x.Id] / total * 100m, 1)
                })
                .OrderByDescending(x => x.Value)
                .ToList();
            if (result.ValueByLocation.Count > TOP_LOCATIONS)
            {
                List<SilaLocationValueDto> rest = result.ValueByLocation.Skip(TOP_LOCATIONS - 1).ToList();
                decimal restValue = rest.Sum(x => x.Value);
                result.ValueByLocation = result.ValueByLocation.Take(TOP_LOCATIONS - 1).ToList();
                result.ValueByLocation.Add(new SilaLocationValueDto
                {
                    LocationName = $"Other locations ({rest.Count})",
                    Value = restValue,
                    SharePercent = total == 0 ? 0 : Math.Round(restValue / total * 100m, 1),
                    Aggregated = true
                });
            }
        }

        /// <summary>Today's movements by kind, and the recipe consumption of the last 7 days.</summary>
        public static async Task ApplyMovementsAsync(
            IRepositoryWrapper repository, Guid buyerId, List<Guid> scopeIds, HashSet<Guid>? materialFilter,
            SilaInventoryDashboardDto result, CancellationToken cancellationToken, DateTime? businessDate = null)
        {
            DateTime today = (businessDate ?? DateTime.UtcNow).Date;
            DateTime tomorrow = today.AddDays(1);
            List<GroupRow> todayRows = await repository.InventoryTransaction
                .FindByCondition(x => x.BuyerId == buyerId && scopeIds.Contains(x.LocationId) && x.BusinessDate >= today && x.BusinessDate < tomorrow)
                .GroupBy(x => new { x.TransactionType, x.MaterialId })
                .Select(x => new GroupRow { Key = x.Key.TransactionType, MaterialId = x.Key.MaterialId, Count = x.Count(), Value = x.Sum(row => row.Value ?? 0) })
                .ToListAsync(cancellationToken);
            if (materialFilter != null)
            {
                todayRows = todayRows.Where(x => materialFilter.Contains(x.MaterialId)).ToList();
            }

            result.MovementToday = MovementBuckets.Select(bucket => new SilaMovementBucketDto
            {
                Key = bucket.Key,
                Label = bucket.Label,
                Count = todayRows.Where(x => bucket.Types.Contains(x.Key)).Sum(x => x.Count),
                Value = todayRows.Where(x => bucket.Types.Contains(x.Key)).Sum(x => x.Value)
            }).ToList();

            DateTime weekAgo = today.AddDays(-6);
            List<GroupRow> consumption = await repository.InventoryTransaction
                .FindByCondition(x => x.BuyerId == buyerId && scopeIds.Contains(x.LocationId)
                    && x.TransactionType == Common.SILA_TXN_RECIPE_CONSUMPTION && x.BusinessDate >= weekAgo && x.BusinessDate < tomorrow)
                .GroupBy(x => new { x.MaterialId, x.BaseUom, x.LocationId })
                .Select(x => new GroupRow
                {
                    Key = x.Key.BaseUom,
                    MaterialId = x.Key.MaterialId,
                    LocationId = x.Key.LocationId,
                    Quantity = x.Sum(row => row.Quantity),
                    Value = x.Sum(row => row.Value ?? 0)
                })
                .ToListAsync(cancellationToken);
            Dictionary<(Guid MaterialId, string Uom), List<Guid>> consumers = consumption
                .GroupBy(x => (x.MaterialId, x.Key))
                .ToDictionary(x => x.Key, x => x.Select(row => row.LocationId).Distinct().ToList());
            consumption = consumption
                .GroupBy(x => (x.MaterialId, x.Key))
                .Select(x => new GroupRow { Key = x.Key.Key, MaterialId = x.Key.MaterialId, Quantity = x.Sum(row => row.Quantity), Value = x.Sum(row => row.Value) })
                .ToList();
            if (materialFilter != null)
            {
                consumption = consumption.Where(x => materialFilter.Contains(x.MaterialId)).ToList();
            }

            consumption = consumption.OrderByDescending(x => x.Value).ThenByDescending(x => x.Quantity).Take(TOP_CONSUMPTION).ToList();
            List<Guid> ids = consumption.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = await repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            List<Guid> consumerIds = consumers.Values.SelectMany(x => x).Distinct().ToList();
            Dictionary<Guid, string> locationNames = await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && consumerIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.LocationName, cancellationToken);
            result.TopConsumption = consumption.Select(x => new SilaConsumptionRowDto
            {
                MaterialId = x.MaterialId,
                MaterialCode = materials.TryGetValue(x.MaterialId, out ItemBuyerMaster? material) ? material.MaterialCode ?? string.Empty : string.Empty,
                MaterialName = material?.Description ?? string.Empty,
                Quantity = x.Quantity,
                Uom = x.Key,
                Value = x.Value,
                LocationName = ConsumerName(consumers.GetValueOrDefault((x.MaterialId, x.Key)), locationNames)
            }).ToList();
        }

        /// <summary>Open transfers by status, open stock counts, and the open alerts with their recommended actions.</summary>
        public static async Task ApplyWorkAsync(
            IRepositoryWrapper repository, Guid buyerId, List<InventoryLocation> scope, bool includeUnlocated,
            SilaInventoryDashboardDto result, CancellationToken cancellationToken)
        {
            List<Guid> scopeIds = scope.Select(x => x.Id).ToList();
            List<GroupRow> stages = await repository.InternalTransferOrder
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && OpenTransferStatuses.Contains(x.Status)
                    && (scopeIds.Contains(x.FromLocationId) || scopeIds.Contains(x.ToLocationId)))
                .GroupBy(x => x.Status)
                .Select(x => new GroupRow { Key = x.Key, Count = x.Count() })
                .ToListAsync(cancellationToken);
            result.TransferStages = OpenTransferStatuses
                .Select(status => new SilaTransferStageDto
                {
                    Status = status,
                    Count = stages.Where(x => x.Key == status).Sum(x => x.Count),
                    Label = StageLabel(status),
                    Tab = status == Common.SILA_ITO_DISPATCHED ? "in-transit" : status == Common.SILA_ITO_DISCREPANCY ? "completed" : "to-approve"
                })
                .ToList();
            result.Kpis.OpenTransfers = result.TransferStages.Where(x => x.Status != Common.SILA_ITO_DISCREPANCY).Sum(x => x.Count);

            result.Kpis.OpenCounts = await repository.StockCount
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && scopeIds.Contains(x.LocationId)
                    && (x.Status == Common.SILA_COUNT_IN_PROGRESS || x.Status == Common.SILA_COUNT_SUBMITTED || x.Status == Common.SILA_COUNT_ENQUIRY_PENDING))
                .CountAsync(cancellationToken);

            IQueryable<InventoryAlert> alerts = repository.InventoryAlert
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive
                    && (x.Status == Common.SILA_ALERT_NEW || x.Status == Common.SILA_ALERT_ACKNOWLEDGED)
                    && ((x.LocationId != null && scopeIds.Contains(x.LocationId.Value)) || (includeUnlocated && x.LocationId == null)));
            result.Kpis.OpenAlerts = await alerts.CountAsync(cancellationToken);
            List<InventoryAlert> top = await alerts
                .OrderBy(x => x.Severity == Common.SILA_SEVERITY_CRITICAL ? 0 : x.Severity == Common.SILA_SEVERITY_HIGH ? 1 : x.Severity == Common.SILA_SEVERITY_MEDIUM ? 2 : 3)
                .ThenBy(x => x.Status == Common.SILA_ALERT_NEW ? 0 : 1)
                .ThenByDescending(x => x.DateCreated)
                .Take(TOP_ACTIONS)
                .ToListAsync(cancellationToken);
            List<Guid> materialIds = top.Where(x => x.MaterialId != null).Select(x => x.MaterialId!.Value).Distinct().ToList();
            Dictionary<Guid, string> codes = await repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.MaterialCode ?? string.Empty, cancellationToken);
            Dictionary<Guid, string> names = scope.ToDictionary(x => x.Id, x => x.LocationName);
            result.Actions = top.Select(x => new SilaDashboardActionDto
            {
                AlertId = x.Id,
                AlertType = x.AlertType,
                Severity = x.Severity,
                Status = x.Status,
                Title = x.Title,
                Message = x.Message,
                LocationId = x.LocationId,
                LocationName = x.LocationId != null && names.TryGetValue(x.LocationId.Value, out string? name) ? name : null,
                MaterialId = x.MaterialId,
                MaterialCode = x.MaterialId != null && codes.TryGetValue(x.MaterialId.Value, out string? code) ? code : null,
                RecommendedAction = x.RecommendedAction,
                ReferenceType = x.ReferenceType,
                ReferenceId = x.ReferenceId,
                CreatedOn = x.DateCreated
            }).ToList();
        }

        private static string StageLabel(string status)
        {
            return status switch
            {
                Common.SILA_ITO_PENDING_APPROVAL => "Awaiting approval",
                Common.SILA_ITO_APPROVED => "Awaiting dispatch",
                Common.SILA_ITO_DISPATCHED => "Awaiting receipt",
                Common.SILA_ITO_DISCREPANCY => "Discrepancies",
                _ => status
            };
        }

        private static string? ConsumerName(List<Guid>? locationIds, Dictionary<Guid, string> names)
        {
            if (locationIds == null || locationIds.Count == 0)
            {
                return null;
            }

            return locationIds.Count == 1 ? names.GetValueOrDefault(locationIds[0]) : $"{locationIds.Count} locations";
        }

        private sealed class BalanceRow
        {
            public Guid LocationId { get; set; }
            public Guid MaterialId { get; set; }
            public decimal OnHandQty { get; set; }
            public decimal? UnitCost { get; set; }
        }

        /// <summary>A grouped row: Key is the transaction type, unit or status of the group.</summary>
        private sealed class GroupRow
        {
            public string Key { get; set; } = string.Empty;
            public Guid MaterialId { get; set; }
            public Guid LocationId { get; set; }
            public int Count { get; set; }
            public decimal Quantity { get; set; }
            public decimal Value { get; set; }
        }
    }
}
