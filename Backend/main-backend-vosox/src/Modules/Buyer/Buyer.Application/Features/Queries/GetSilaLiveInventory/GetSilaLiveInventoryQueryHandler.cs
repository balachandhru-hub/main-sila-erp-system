using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaLiveInventory
{
    /// <summary>
    /// Searches materials and sums their stock over the caller's locations (or one of them). Without a location the search
    /// needs at least two characters; with a location, the materials holding a balance there are listed.
    /// </summary>
    public class GetSilaLiveInventoryQueryHandler : IRequestHandler<GetSilaLiveInventoryQuery, List<SilaLiveInventoryRowDto>>
    {
        private const int MinimumSearchLength = 2;

        private const int SEARCH_LENGTH = 100;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaLiveInventoryQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaLiveInventoryRowDto>> Handle(GetSilaLiveInventoryQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Searching live inventory. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, Search: {request.Search}, LocationId: {request.LocationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaInputRules.MaxLength(_logger, request.Search, SEARCH_LENGTH, "Search");
            string term = (request.Search ?? string.Empty).Trim();
            bool hasLocation = request.LocationId != null && request.LocationId != Guid.Empty;
            if (!hasLocation && term.Length < MinimumSearchLength)
            {
                _logger.LogInfo("Live inventory search skipped: search too short and no location.");
                return new List<SilaLiveInventoryRowDto>();
            }

            List<Guid> scope;
            if (hasLocation)
            {
                Guid locationId = request.LocationId!.Value;
                await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, locationId);
                await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, locationId, cancellationToken);
                scope = new List<Guid> { locationId };
            }
            else
            {
                scope = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            }

            int index = request.Index < 0 ? 0 : request.Index;
            int limit = SilaInputRules.Limit(request.Limit, 20);
            IQueryable<MaterialEntity> query = _repository.ItemBuyerMaster.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (hasLocation)
            {
                IQueryable<Guid> stockedIds = _repository.InventoryBalance
                    .FindByCondition(x => scope.Contains(x.LocationId) && x.IsActive)
                    .Select(x => x.MaterialId);
                query = query.Where(x => stockedIds.Contains(x.Id));
            }

            if (term.Length > 0)
            {
                query = query.Where(x =>
                    (x.MaterialCode != null && x.MaterialCode.Contains(term)) ||
                    (x.Description != null && x.Description.Contains(term)) ||
                    (x.Barcode != null && x.Barcode == term));
            }

            List<MaterialEntity> materials = await query
                .OrderBy(x => x.MaterialCode)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);
            List<Guid> materialIds = materials.Select(x => x.Id).ToList();
            List<InventoryBalance> balances = await _repository.InventoryBalance
                .FindByCondition(x => materialIds.Contains(x.MaterialId) && scope.Contains(x.LocationId) && x.IsActive)
                .ToListAsync(cancellationToken);

            List<SilaLiveInventoryRowDto> result = materials.Select(material =>
            {
                List<InventoryBalance> rows = balances.Where(x => x.MaterialId == material.Id).ToList();
                return new SilaLiveInventoryRowDto
                {
                    MaterialId = material.Id,
                    MaterialCode = material.MaterialCode ?? string.Empty,
                    Description = material.Description ?? string.Empty,
                    BaseUom = UomConverter.BaseUomOf(material),
                    OnHandQty = rows.Sum(x => x.OnHandQty),
                    InTransitQty = rows.Sum(x => x.InTransitQty),
                    LocationCount = rows.Count(x => x.OnHandQty != 0 || x.InTransitQty != 0)
                };
            }).ToList();

            _logger.LogInfo($"Live inventory searched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}
