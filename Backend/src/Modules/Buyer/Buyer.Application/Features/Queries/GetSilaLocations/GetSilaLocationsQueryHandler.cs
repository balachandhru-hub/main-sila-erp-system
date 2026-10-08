using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaLocations
{
    public class GetSilaLocationsQueryHandler : IRequestHandler<GetSilaLocationsQuery, List<SilaLocationResponseDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaLocationsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        private static readonly string[] StatusFilters =
        {
            SilaLocationRules.STATUS_ACTIVE, SilaLocationRules.STATUS_INACTIVE, SilaLocationRules.STATUS_ALL
        };

        private static readonly string[] LocationTypes = { Common.SILA_LOCATION_STORE, Common.SILA_LOCATION_OUTLET, Common.SILA_LOCATION_VENUE };

        public async Task<List<SilaLocationResponseDto>> Handle(GetSilaLocationsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching inventory locations. OrganizationId: {request.OrganizationId}, LocationType: {request.LocationType}, PropertyId: {request.PropertyId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            string status = string.IsNullOrWhiteSpace(request.Status)
                ? SilaLocationRules.STATUS_ACTIVE
                : SilaInputRules.OneOf(_logger, request.Status, StatusFilters, "status");
            IQueryable<InventoryLocation> query = _repository.InventoryLocation.FindByCondition(x => x.BuyerId == buyer.Id);
            if (status != SilaLocationRules.STATUS_ALL)
            {
                bool active = status == SilaLocationRules.STATUS_ACTIVE;
                query = query.Where(x => x.IsActive == active);
            }
            if (!string.IsNullOrWhiteSpace(request.LocationType))
            {
                string locationType = SilaInputRules.OneOf(_logger, request.LocationType, LocationTypes, "location type");
                query = query.Where(x => x.LocationType == locationType);
            }

            if (request.PropertyId != null && request.PropertyId != Guid.Empty)
            {
                Guid propertyId = request.PropertyId.Value;
                query = query.Where(x => x.PropertyId == propertyId);
            }

            List<InventoryLocation> locations = await query.ToListAsync(cancellationToken);
            // Ordered by property name (another table), so the page is taken after ordering; a buyer has few locations.
            List<SilaLocationResponseDto> result = (await SilaLocationRules.ToResponseAsync(_repository, buyer.Id, locations, cancellationToken))
                .Skip(SilaInputRules.Index(request.Index))
                .Take(SilaInputRules.Limit(request.Limit, SilaInputRules.MAX_LIMIT))
                .ToList();

            _logger.LogInfo($"Inventory locations fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}
