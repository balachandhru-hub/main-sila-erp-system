using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.RaiseLowStockAlerts
{
    public class RaiseLowStockAlertsCommandHandler : IRequestHandler<RaiseLowStockAlertsCommand, int>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public RaiseLowStockAlertsCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<int> Handle(RaiseLowStockAlertsCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Checking stock levels for low-stock alerts. BuyerId: {request.BuyerId}");

            // The current month's override (LocationMaterialThreshold) replaces the base level of the stocking row.
            int month = DateTime.UtcNow.Month;
            List<Guid> overriddenIds = await _repository.LocationMaterialThreshold
                .FindByCondition(x => x.IsActive && x.Month == month && (x.ReorderPoint != null || x.MinimumStock != null))
                .Select(x => x.LocationMaterialId)
                .ToListAsync(cancellationToken);
            List<InventoryLocationMaterial> stocking = await _repository.InventoryLocationMaterial
                .FindByCondition(x => x.IsActive && (x.ReorderPoint != null || x.MinimumStock != null || overriddenIds.Contains(x.Id))
                    && (request.BuyerId == null || x.InventoryLocation.BuyerId == request.BuyerId))
                .ToListAsync(cancellationToken);
            Dictionary<(Guid LocationMaterialId, int Month), LocationMaterialThreshold> thresholds = await SilaStockLevels.GetThresholdsAsync(
                _repository, stocking.Select(x => x.Id).ToList(), month, cancellationToken);
            List<Guid> locationIds = stocking.Select(x => x.LocationId).Distinct().ToList();
            Dictionary<Guid, InventoryLocation> locations = await _repository.InventoryLocation
                .FindByCondition(x => x.IsActive && locationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<(Guid LocationId, Guid MaterialId), InventoryBalance> balances = (await _repository.InventoryBalance
                    .FindByCondition(x => x.IsActive && locationIds.Contains(x.LocationId))
                    .ToListAsync(cancellationToken))
                .GroupBy(x => (x.LocationId, x.MaterialId))
                .ToDictionary(x => x.Key, x => x.First());
            List<Guid> materialIds = stocking.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.IsActive && materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);

            Dictionary<Guid, InventoryLedger> ledgers = new Dictionary<Guid, InventoryLedger>();
            int low = 0;
            foreach (InventoryLocationMaterial row in stocking)
            {
                if (!locations.TryGetValue(row.LocationId, out InventoryLocation? location)
                    || !materials.TryGetValue(row.MaterialId, out ItemBuyerMaster? material)
                    || material.BuyerId != location.BuyerId)
                {
                    continue;
                }

                SilaEffectiveLevels levels = SilaStockLevels.Effective(row, thresholds, month);
                if (levels.Threshold == null)
                {
                    continue;
                }

                decimal threshold = levels.Threshold.Value;
                InventoryBalance? balance = balances.TryGetValue((row.LocationId, row.MaterialId), out InventoryBalance? found) ? found : null;
                decimal onHand = balance?.OnHandQty ?? 0;
                if (onHand >= threshold)
                {
                    continue;
                }

                if (!ledgers.TryGetValue(location.BuyerId, out InventoryLedger? ledger))
                {
                    ledger = new InventoryLedger(_repository, location.BuyerId, Guid.Empty);
                    ledgers[location.BuyerId] = ledger;
                }

                string uom = balance?.BaseUom ?? UomConverter.BaseUomOf(material);
                low++;
                await ledger.RaiseAlertAsync(new InventoryAlert
                {
                    AlertType = Common.SILA_ALERT_LOW_STOCK,
                    Severity = Common.SILA_SEVERITY_HIGH,
                    Title = $"Low stock: {material.Description}",
                    Message = $"{location.LocationName} has {onHand:0.####} {uom}, below the reorder level of {threshold:0.####} {uom}. Request a transfer.",
                    LocationId = location.Id,
                    MaterialId = material.Id,
                    RecommendedAction = Common.SILA_ACTION_REQUEST_TRANSFER
                }, cancellationToken);
            }

            await _repository.SaveAsync();

            _logger.LogInfo($"Low-stock check done. Checked: {stocking.Count}, BelowThreshold: {low}, Buyers: {ledgers.Count}");
            return low;
        }
    }
}
