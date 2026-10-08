using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SetSilaLocationMaterials
{
    /// <summary>
    /// Saves the stocking rows of a location (minimum stock, par level, reorder point per material). The request is the
    /// full list: rows left out are deactivated.
    /// </summary>
    public class SetSilaLocationMaterialsCommandHandler : IRequestHandler<SetSilaLocationMaterialsCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SetSilaLocationMaterialsCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(SetSilaLocationMaterialsCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Saving location stocking rows. LocationId: {request.LocationId}, OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.LocationId);
            List<SilaLocationMaterialItemWriteDto> items = request.Request.Items ?? new List<SilaLocationMaterialItemWriteDto>();

            if (items.GroupBy(x => x.MaterialId).Any(group => group.Count() > 1))
            {
                _logger.LogError($"Duplicate material in stocking rows. LocationId: {location.Id}");
                throw new BadRequestCustomException("Duplicate material.", "List each material only once.");
            }

            if (items.Any(x => x.MinimumStock < 0 || x.ParLevel < 0 || x.ReorderPoint < 0
                || x.MinimumStock > SilaInputRules.MAX_QUANTITY || x.ParLevel > SilaInputRules.MAX_QUANTITY || x.ReorderPoint > SilaInputRules.MAX_QUANTITY))
            {
                _logger.LogError($"Negative stocking level. LocationId: {location.Id}");
                throw new BadRequestCustomException("Invalid stocking level.", "Enter a number from 0 up to 1,000,000,000 for minimum stock, par level and reorder point.");
            }

            if (items.Any(x => x.MaximumStock < 0 || x.SafetyStock < 0 || x.MaximumStock > SilaInputRules.MAX_QUANTITY || x.SafetyStock > SilaInputRules.MAX_QUANTITY))
            {
                _logger.LogError($"Invalid maximum or safety stock. LocationId: {location.Id}");
                throw new BadRequestCustomException("Invalid stocking level.", "Enter a number from 0 up to 1,000,000,000 for maximum stock and safety stock.");
            }

            if (items.Any(x => x.MaximumStock != null && x.MinimumStock != null && x.MaximumStock < x.MinimumStock))
            {
                _logger.LogError($"Maximum stock below minimum stock. LocationId: {location.Id}");
                throw new BadRequestCustomException("Maximum stock is below minimum stock.", "Enter a maximum stock at or above the minimum stock.");
            }

            foreach (SilaLocationMaterialItemWriteDto item in items.Where(x => !string.IsNullOrWhiteSpace(x.StockingType)))
            {
                item.StockingType = SilaInputRules.OneOf(_logger, item.StockingType, SilaLocationStocking.StockingTypes, "stocking type");
            }

            foreach (SilaLocationMaterialItemWriteDto item in items.Where(x => x.MonthlyThresholds != null))
            {
                ValidateThresholds(location.Id, item.MonthlyThresholds!);
            }

            await SilaAccess.GetMaterialsAsync(_repository, _logger, buyer.Id, items.Select(x => x.MaterialId), cancellationToken);

            // Rows are unique per (location, material), also when inactive: update them instead of inserting again.
            List<InventoryLocationMaterial> existing = await _repository.InventoryLocationMaterial
                .FindByCondition(x => x.LocationId == location.Id)
                .ToListAsync(cancellationToken);
            List<InventoryLocationMaterial> changed = new List<InventoryLocationMaterial>();
            foreach (InventoryLocationMaterial row in existing)
            {
                SilaLocationMaterialItemWriteDto? item = items.FirstOrDefault(x => x.MaterialId == row.MaterialId);
                if (item == null)
                {
                    if (row.IsActive)
                    {
                        row.IsActive = false;
                        changed.Add(row);
                    }

                    continue;
                }

                row.MinimumStock = item.MinimumStock;
                row.ParLevel = item.ParLevel;
                row.ReorderPoint = item.ReorderPoint;
                row.MaximumStock = item.MaximumStock;
                row.SafetyStock = item.SafetyStock;
                row.StockingType = string.IsNullOrWhiteSpace(item.StockingType) ? row.StockingType ?? SilaLocationStocking.TYPE_REGULAR : item.StockingType;
                row.IsActive = true;
                changed.Add(row);
            }

            if (changed.Count > 0)
            {
                _repository.InventoryLocationMaterial.UpdateRange(changed);
            }

            Dictionary<Guid, Guid> rowIds = existing.ToDictionary(x => x.MaterialId, x => x.Id);
            foreach (SilaLocationMaterialItemWriteDto item in items.Where(x => !existing.Any(row => row.MaterialId == x.MaterialId)))
            {
                Guid rowId = Guid.NewGuid();
                rowIds[item.MaterialId] = rowId;
                _repository.InventoryLocationMaterial.Create(new InventoryLocationMaterial
                {
                    Id = rowId,
                    LocationId = location.Id,
                    MaterialId = item.MaterialId,
                    MinimumStock = item.MinimumStock,
                    ParLevel = item.ParLevel,
                    ReorderPoint = item.ReorderPoint,
                    MaximumStock = item.MaximumStock,
                    SafetyStock = item.SafetyStock,
                    StockingType = string.IsNullOrWhiteSpace(item.StockingType) ? SilaLocationStocking.TYPE_REGULAR : item.StockingType,
                    IsActive = true
                });
            }

            await SaveThresholdsAsync(items, rowIds, cancellationToken);
            await _repository.SaveAsync();

            _logger.LogInfo($"Location stocking rows saved. LocationId: {location.Id}, Count: {items.Count}");
            return Unit.Value;
        }

        private void ValidateThresholds(Guid locationId, List<SilaMonthlyThresholdDto> thresholds)
        {
            if (thresholds.Any(x => x.Month < 1 || x.Month > 12))
            {
                _logger.LogError($"Month override outside 1-12. LocationId: {locationId}");
                throw new BadRequestCustomException("Invalid month.", "Month overrides must use months 1 (January) to 12 (December).");
            }

            if (thresholds.GroupBy(x => x.Month).Any(x => x.Count() > 1))
            {
                _logger.LogError($"Month override repeated. LocationId: {locationId}");
                throw new BadRequestCustomException("A month appears more than once.", "Enter each month at most once per material.");
            }

            if (thresholds.Any(x => x.MinimumStock < 0 || x.ReorderPoint < 0))
            {
                _logger.LogError($"Negative month override. LocationId: {locationId}");
                throw new BadRequestCustomException("Invalid month override.", "Enter zero or a positive number for the monthly minimum stock and reorder point.");
            }
        }

        /// <summary>
        /// Replaces the month overrides of the rows that sent them. Rows are unique per (stocking row, month), so existing
        /// rows are updated or deactivated instead of inserted again. A month without values is removed.
        /// </summary>
        private async Task SaveThresholdsAsync(
            List<SilaLocationMaterialItemWriteDto> items, Dictionary<Guid, Guid> rowIds, CancellationToken cancellationToken)
        {
            List<SilaLocationMaterialItemWriteDto> withOverrides = items.Where(x => x.MonthlyThresholds != null).ToList();
            if (withOverrides.Count == 0)
            {
                return;
            }

            List<Guid> ids = withOverrides.Select(x => rowIds[x.MaterialId]).ToList();
            List<LocationMaterialThreshold> saved = await _repository.LocationMaterialThreshold
                .FindByCondition(x => ids.Contains(x.LocationMaterialId))
                .ToListAsync(cancellationToken);
            List<LocationMaterialThreshold> changed = new List<LocationMaterialThreshold>();
            foreach (SilaLocationMaterialItemWriteDto item in withOverrides)
            {
                Guid rowId = rowIds[item.MaterialId];
                List<SilaMonthlyThresholdDto> wanted = item.MonthlyThresholds!
                    .Where(x => x.MinimumStock != null || x.ReorderPoint != null)
                    .ToList();
                foreach (LocationMaterialThreshold row in saved.Where(x => x.LocationMaterialId == rowId))
                {
                    SilaMonthlyThresholdDto? value = wanted.FirstOrDefault(x => x.Month == row.Month);
                    row.IsActive = value != null;
                    row.MinimumStock = value?.MinimumStock;
                    row.ReorderPoint = value?.ReorderPoint;
                    changed.Add(row);
                }

                foreach (SilaMonthlyThresholdDto value in wanted.Where(x => !saved.Any(row => row.LocationMaterialId == rowId && row.Month == x.Month)))
                {
                    _repository.LocationMaterialThreshold.Create(new LocationMaterialThreshold
                    {
                        Id = Guid.NewGuid(),
                        LocationMaterialId = rowId,
                        Month = value.Month,
                        MinimumStock = value.MinimumStock,
                        ReorderPoint = value.ReorderPoint,
                        IsActive = true
                    });
                }
            }

            if (changed.Count > 0)
            {
                _repository.LocationMaterialThreshold.UpdateRange(changed);
            }
        }
    }
}
