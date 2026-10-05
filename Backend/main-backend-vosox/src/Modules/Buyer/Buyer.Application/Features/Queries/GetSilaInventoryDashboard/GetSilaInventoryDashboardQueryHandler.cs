using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInventoryDashboard
{
    /// <summary>
    /// The inventory control center: KPIs, stock health, action center, replenishment list, today's movements, transfer
    /// stages, value by location and top consumption, for the caller's stores and outlets narrowed by the filters.
    /// </summary>
    public class GetSilaInventoryDashboardQueryHandler : IRequestHandler<GetSilaInventoryDashboardQuery, SilaInventoryDashboardDto>
    {
        private const int MAX_GROUP = 100;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaInventoryDashboardQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInventoryDashboardDto> Handle(GetSilaInventoryDashboardQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching inventory dashboard. OrganizationId: {request.OrganizationId}, PropertyId: {request.PropertyId}, LocationId: {request.LocationId}, LocationType: {request.LocationType}");

            string? locationType = string.IsNullOrWhiteSpace(request.LocationType) ? null : request.LocationType.Trim().ToUpperInvariant();
            if (locationType != null && locationType != Common.SILA_LOCATION_STORE && locationType != Common.SILA_LOCATION_OUTLET)
            {
                _logger.LogError($"Invalid dashboard location type. LocationType: {locationType}");
                throw new BadRequestCustomException("Invalid location type.", "Filter by STORE or OUTLET.");
            }

            string? materialGroup = string.IsNullOrWhiteSpace(request.MaterialGroup) ? null : request.MaterialGroup.Trim();
            if (materialGroup != null && materialGroup.Length > MAX_GROUP)
            {
                _logger.LogError($"Material group filter too long. Length: {materialGroup.Length}");
                throw new BadRequestCustomException("The material group filter is too long.", $"Enter at most {MAX_GROUP} characters.");
            }

            SilaInputRules.SaneDate(_logger, request.BusinessDate, "business date", 2, 1);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<InventoryLocation> scope = await ResolveScopeAsync(request, buyer.Id, locationType, cancellationToken);
            HashSet<Guid>? materialFilter = null;
            if (materialGroup != null)
            {
                materialFilter = (await _repository.ItemBuyerMaster
                        .FindByCondition(x => x.BuyerId == buyer.Id && x.MaterialGroup != null && x.MaterialGroup.Contains(materialGroup))
                        .Select(x => x.Id)
                        .ToListAsync(cancellationToken))
                    .ToHashSet();
            }

            int month = DateTime.UtcNow.Month;
            SilaInventoryDashboardDto result = new SilaInventoryDashboardDto { Month = month };
            if (scope.Count == 0)
            {
                _logger.LogInfo($"Inventory dashboard has no location in scope. BuyerId: {buyer.Id}, UserId: {request.UserId}");
                return result;
            }

            List<Guid> scopeIds = scope.Select(x => x.Id).ToList();
            (List<SilaReplenishmentRowDto> rows, SilaStockHealthDto health) = await SilaReplenishment.BuildAsync(
                _repository, buyer.Id, scope, materialFilter, month, cancellationToken);
            result.Replenishment = rows;
            result.Health = health;
            result.Kpis.LowStock = health.Low;
            result.Kpis.OutOfStock = health.Out;

            await SilaDashboardFigures.ApplyStockAsync(_repository, buyer.Id, scope, materialFilter, result, cancellationToken);
            DateTime businessDate = (request.BusinessDate ?? DateTime.UtcNow).Date;
            await SilaDashboardFigures.ApplyMovementsAsync(_repository, buyer.Id, scopeIds, materialFilter, result, cancellationToken, businessDate);
            bool unfiltered = request.PropertyId == null && request.LocationId == null && locationType == null;
            await SilaDashboardFigures.ApplyWorkAsync(
                _repository, buyer.Id, scope, unfiltered && SilaAccess.HasFullAccess(request.RoleId), result, cancellationToken);
            await SilaDashboardNotes.ApplyAsync(_repository, buyer.Id, scope, materialFilter, businessDate, result, cancellationToken);
            await SilaDashboardActionAdvice.ApplyAsync(_repository, buyer.Id, month, result, cancellationToken);

            _logger.LogInfo($"Inventory dashboard fetched. BuyerId: {buyer.Id}, Locations: {scope.Count}, Replenishment: {result.Replenishment.Count}, OpenAlerts: {result.Kpis.OpenAlerts}");
            return result;
        }

        /// <summary>The caller's active stores and outlets, narrowed by property, location (a venue means its locations) and type.</summary>
        private async Task<List<InventoryLocation>> ResolveScopeAsync(
            GetSilaInventoryDashboardQuery request, Guid buyerId, string? locationType, CancellationToken cancellationToken)
        {
            List<Guid> mine = await SilaAccess.GetLocationIdsAsync(_repository, buyerId, request.UserId, request.RoleId, cancellationToken);
            List<InventoryLocation> locations = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && mine.Contains(x.Id))
                .ToListAsync(cancellationToken);

            if (request.LocationId != null)
            {
                InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyerId, request.LocationId.Value);
                if (location.LocationType == Common.SILA_LOCATION_VENUE)
                {
                    locations = locations.Where(x => x.ParentLocationId == location.Id).ToList();
                }
                else
                {
                    await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyerId, request.UserId, request.RoleId, location.Id, cancellationToken);
                    locations = locations.Where(x => x.Id == location.Id).ToList();
                }
            }

            if (request.PropertyId != null)
            {
                locations = locations.Where(x => x.PropertyId == request.PropertyId.Value).ToList();
            }

            if (locationType != null)
            {
                locations = locations.Where(x => x.LocationType == locationType).ToList();
            }

            return locations.Where(x => x.LocationType != Common.SILA_LOCATION_VENUE).ToList();
        }
    }
}
