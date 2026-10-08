using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaLocationMaterials
{
    public class GetSilaLocationMaterialsQueryHandler : IRequestHandler<GetSilaLocationMaterialsQuery, List<SilaLocationMaterialDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaLocationMaterialsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaLocationMaterialDto>> Handle(GetSilaLocationMaterialsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching location stocking rows. LocationId: {request.LocationId}, OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.LocationId);
            List<InventoryLocationMaterial> rows = await _repository.InventoryLocationMaterial
                .FindByCondition(x => x.LocationId == location.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            List<Guid> materialIds = rows.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, MaterialEntity> materials = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyer.Id && materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, decimal> onHand = await _repository.InventoryBalance
                .FindByCondition(x => x.LocationId == location.Id && materialIds.Contains(x.MaterialId))
                .ToDictionaryAsync(x => x.MaterialId, x => x.OnHandQty, cancellationToken);

            Dictionary<(Guid LocationMaterialId, int Month), LocationMaterialThreshold> thresholds = await SilaStockLevels.GetThresholdsAsync(
                _repository, rows.Select(x => x.Id).ToList(), null, cancellationToken);

            List<SilaLocationMaterialDto> result = rows
                .Where(x => materials.ContainsKey(x.MaterialId))
                .Select(x => new SilaLocationMaterialDto
                {
                    MaterialId = x.MaterialId,
                    MaterialCode = materials[x.MaterialId].MaterialCode ?? string.Empty,
                    Description = materials[x.MaterialId].Description ?? string.Empty,
                    BaseUom = UomConverter.BaseUomOf(materials[x.MaterialId]),
                    MinimumStock = x.MinimumStock,
                    ParLevel = x.ParLevel,
                    ReorderPoint = x.ReorderPoint,
                    StockingType = x.StockingType ?? SilaLocationStocking.TYPE_REGULAR,
                    MaximumStock = x.MaximumStock,
                    SafetyStock = x.SafetyStock,
                    Active = x.IsActive,
                    OnHandQty = onHand.TryGetValue(x.MaterialId, out decimal quantity) ? quantity : 0,
                    MonthlyThresholds = thresholds.Values
                        .Where(t => t.LocationMaterialId == x.Id)
                        .OrderBy(t => t.Month)
                        .Select(t => new SilaMonthlyThresholdDto { Month = t.Month, MinimumStock = t.MinimumStock, ReorderPoint = t.ReorderPoint })
                        .ToList()
                })
                .OrderBy(x => x.MaterialCode)
                .ToList();

            _logger.LogInfo($"Location stocking rows fetched. Count: {result.Count}, LocationId: {location.Id}");
            return result;
        }
    }
}
