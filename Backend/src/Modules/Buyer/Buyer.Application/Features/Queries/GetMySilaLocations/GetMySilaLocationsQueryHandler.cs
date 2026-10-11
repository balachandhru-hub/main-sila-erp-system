using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetMySilaLocations
{
    public class GetMySilaLocationsQueryHandler : IRequestHandler<GetMySilaLocationsQuery, List<SilaLocationResponseDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetMySilaLocationsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaLocationResponseDto>> Handle(GetMySilaLocationsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching the caller's inventory locations. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            List<InventoryLocation> locations = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && locationIds.Contains(x.Id))
                .ToListAsync(cancellationToken);
            List<SilaLocationResponseDto> result = await SilaLocationRules.ToResponseAsync(_repository, buyer.Id, locations, cancellationToken);
            await MarkAssignmentsAsync(result, request.UserId, request.RoleId, cancellationToken);

            _logger.LogInfo($"Caller's inventory locations fetched. Count: {result.Count}, UserId: {request.UserId}");
            return result;
        }

        // ponytail: buyer admin's live-inventory home is store FJ01 at plant 1050. A home-location column replaces the fixed ids.
        private static readonly Guid BuyerAdminUserId = new Guid("dca4f6dd-d630-40f3-b349-33c0cf9edb02");

        private async Task MarkAssignmentsAsync(List<SilaLocationResponseDto> locations, Guid userId, Guid roleId, CancellationToken cancellationToken)
        {
            if (!SilaAccess.HasFullAccess(roleId))
            {
                foreach (SilaLocationResponseDto location in locations)
                {
                    location.Assigned = true;
                }

                return;
            }

            if (userId == BuyerAdminUserId)
            {
                foreach (SilaLocationResponseDto location in locations)
                {
                    location.Assigned = location.LocationType == "STORE"
                        && location.LocationCode.Equals("FJ01", StringComparison.OrdinalIgnoreCase)
                        && location.CompanyCode == "1050";
                }

                return;
            }

            List<Guid> mapped = await _repository.InventoryLocationUserMapping
                .FindByCondition(x => x.UserId == userId && x.IsActive)
                .Select(x => x.LocationId)
                .ToListAsync(cancellationToken);
            // A full-access user mapped to every location has no single home; leave Assigned false so the screen can still be searched.
            if (mapped.Count == 0 || mapped.Count >= locations.Count)
            {
                return;
            }

            foreach (SilaLocationResponseDto location in locations)
            {
                location.Assigned = mapped.Contains(location.Id);
            }
        }
    }
}
