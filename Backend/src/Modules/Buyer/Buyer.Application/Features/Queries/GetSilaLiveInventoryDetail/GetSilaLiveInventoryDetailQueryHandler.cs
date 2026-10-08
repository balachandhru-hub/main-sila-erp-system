using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaLiveInventoryDetail
{
    /// <summary>
    /// A material's stock at every location of the properties the caller works in. Other properties are never shown:
    /// stock is neither visible nor transferable across properties.
    /// </summary>
    public class GetSilaLiveInventoryDetailQueryHandler : IRequestHandler<GetSilaLiveInventoryDetailQuery, SilaLiveInventoryDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaLiveInventoryDetailQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaLiveInventoryDetailDto> Handle(GetSilaLiveInventoryDetailQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching live inventory of a material. MaterialId: {request.MaterialId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Dictionary<Guid, MaterialEntity> found = await SilaAccess.GetMaterialsAsync(
                _repository, _logger, buyer.Id, new List<Guid> { request.MaterialId }, cancellationToken);
            MaterialEntity material = found[request.MaterialId];

            List<Guid> myLocationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            List<Guid> propertyIds = await _repository.InventoryLocation
                .FindByCondition(x => myLocationIds.Contains(x.Id))
                .Select(x => x.PropertyId)
                .Distinct()
                .ToListAsync(cancellationToken);
            List<InventoryLocation> locations = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && propertyIds.Contains(x.PropertyId))
                .ToListAsync(cancellationToken);
            List<Guid> locationIds = locations.Select(x => x.Id).ToList();

            Dictionary<Guid, BuyerProperty> properties = await _repository.BuyerProperty
                .FindByCondition(x => x.BuyerId == buyer.Id && propertyIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, string> propertyNames = properties.ToDictionary(x => x.Key, x => x.Value.PropertyName);
            Dictionary<Guid, InventoryBalance> balances = await _repository.InventoryBalance
                .FindByCondition(x => x.MaterialId == material.Id && locationIds.Contains(x.LocationId) && x.IsActive)
                .ToDictionaryAsync(x => x.LocationId, cancellationToken);
            Dictionary<Guid, InventoryLocationMaterial> stockingRows = (await _repository.InventoryLocationMaterial
                    .FindByCondition(x => x.MaterialId == material.Id && locationIds.Contains(x.LocationId))
                    .ToListAsync(cancellationToken))
                .GroupBy(x => x.LocationId)
                .ToDictionary(x => x.Key, x => x.OrderByDescending(row => row.IsActive).First());
            Dictionary<Guid, InventoryLocationMaterial> stocking = stockingRows.Where(x => x.Value.IsActive).ToDictionary(x => x.Key, x => x.Value);
            Dictionary<Guid, decimal> reserved = await SilaLiveStockFigures.GetReservedAsync(_repository, buyer.Id, material.Id, locationIds, cancellationToken);
            int month = DateTime.UtcNow.Month;
            Dictionary<(Guid LocationMaterialId, int Month), LocationMaterialThreshold> thresholds = await SilaStockLevels.GetThresholdsAsync(
                _repository, stocking.Values.Select(x => x.Id).ToList(), month, cancellationToken);

            // Locations holding the material, stocking it, or worked at by the caller.
            List<SilaLiveInventoryLocationDto> rows = locations
                .Where(x => balances.ContainsKey(x.Id) || stocking.ContainsKey(x.Id) || myLocationIds.Contains(x.Id))
                .Select(x =>
                {
                    InventoryBalance? balance = balances.TryGetValue(x.Id, out InventoryBalance? b) ? b : null;
                    InventoryLocationMaterial? level = stocking.TryGetValue(x.Id, out InventoryLocationMaterial? s) ? s : null;
                    return new SilaLiveInventoryLocationDto
                    {
                        LocationId = x.Id,
                        LocationCode = x.LocationCode,
                        LocationName = x.LocationName,
                        LocationType = x.LocationType,
                        PropertyId = x.PropertyId,
                        PropertyName = propertyNames.TryGetValue(x.PropertyId, out string? name) ? name : string.Empty,
                        OnHandQty = balance?.OnHandQty ?? 0,
                        InTransitQty = balance?.InTransitQty ?? 0,
                        MinimumStock = level?.MinimumStock,
                        TransferEnabled = x.TransferEnabled,
                        IsMine = myLocationIds.Contains(x.Id),
                        LastMovementOn = balance?.LastMovementOn,
                        PropertyCode = properties.TryGetValue(x.PropertyId, out BuyerProperty? property) ? property.PlantCode : null,
                        ReservedQty = reserved.GetValueOrDefault(x.Id),
                        AvailableQty = (balance?.OnHandQty ?? 0) - reserved.GetValueOrDefault(x.Id),
                        StockingStatus = SilaLocationStocking.StatusOf(stockingRows.GetValueOrDefault(x.Id)),
                        StockingType = level == null ? null : level.StockingType ?? SilaLocationStocking.TYPE_REGULAR,
                        StockStatus = SilaLiveStockFigures.StockStatus(balance?.OnHandQty ?? 0, level, thresholds, month)
                    };
                })
                .OrderBy(x => x.IsMine ? 0 : 1)
                .ThenBy(x => x.PropertyName)
                .ThenByDescending(x => x.OnHandQty)
                .ThenBy(x => x.LocationName)
                .ToList();

            if (request.RequiredQty < 0)
            {
                _logger.LogError($"Negative required quantity. RequiredQty: {request.RequiredQty}");
                throw new BadRequestCustomException("Invalid required quantity.", "Enter zero or a positive required quantity.");
            }

            if (request.CurrentLocationId != null && !myLocationIds.Contains(request.CurrentLocationId.Value))
            {
                _logger.LogError($"Current location is not the caller's. LocationId: {request.CurrentLocationId}, UserId: {request.UserId}");
                throw new ForBiddenCustomException("No access to this location.", "Select one of your locations as the current location.");
            }

            QuickTransferPolicy policy = await SilaQuickTransferRules.GetPolicyAsync(_repository, buyer.Id, cancellationToken);
            SilaLiveInventoryDetailDto result = new SilaLiveInventoryDetailDto
            {
                MaterialId = material.Id,
                MaterialCode = material.MaterialCode ?? string.Empty,
                Description = material.Description ?? string.Empty,
                BaseUom = UomConverter.BaseUomOf(material),
                UnitCost = material.UnitCost,
                Currency = material.Currency,
                OnHandQty = rows.Sum(x => x.OnHandQty),
                InTransitQty = rows.Sum(x => x.InTransitQty),
                Locations = rows,
                InventoryType = material.InventoryType,
                InventoryItem = material.IsInventoryItem,
                BatchManaged = material.BatchManaged,
                ExpiryManaged = material.ExpiryManaged,
                SerialManaged = material.SerialManaged
            };
            SilaLiveRecommendation.Apply(result, locations, request.CurrentLocationId, request.RequiredQty ?? 0, policy.Enabled);
            SilaLiveStockFigures.ApplyStocking(result, stockingRows, policy.Enabled);

            _logger.LogInfo($"Live inventory of a material fetched. MaterialId: {material.Id}, Locations: {rows.Count}, Recommendation: {result.Recommendation}");
            return result;
        }
    }
}
