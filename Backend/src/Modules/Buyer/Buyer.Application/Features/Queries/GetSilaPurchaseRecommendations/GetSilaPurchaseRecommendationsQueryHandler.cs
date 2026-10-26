using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPurchaseRecommendations
{
    /// <summary>Scope-valid V1 purchase recommendations for the caller's locations.</summary>
    public class GetSilaPurchaseRecommendationsQueryHandler : IRequestHandler<GetSilaPurchaseRecommendationsQuery, SilaPurchaseRecommendationListDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaPurchaseRecommendationsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaPurchaseRecommendationListDto> Handle(GetSilaPurchaseRecommendationsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching purchase recommendations. OrganizationId: {request.OrganizationId}, LocationId: {request.LocationId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> mine = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            List<InventoryLocation> scope = mine.Count == 0
                ? new List<InventoryLocation>()
                : await _repository.InventoryLocation
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && mine.Contains(x.Id) && x.LocationType != Common.SILA_LOCATION_VENUE)
                    .ToListAsync(cancellationToken);
            if (request.LocationId != null && request.LocationId != Guid.Empty)
            {
                await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, request.LocationId.Value, cancellationToken);
                scope = scope.Where(x => x.Id == request.LocationId.Value).ToList();
            }

            if (request.PropertyId != null && request.PropertyId != Guid.Empty)
            {
                scope = scope.Where(x => x.PropertyId == request.PropertyId.Value).ToList();
            }

            SilaPurchaseRecommendationListDto result = await SilaPurchaseRecommendation.BuildAsync(
                _repository, buyer.Id, scope, DateTime.UtcNow.Month, cancellationToken);
            _logger.LogInfo($"Purchase recommendations fetched. Count: {result.RecommendedPurchase}, Skipped: {result.Skipped.Count}");
            return result;
        }
    }
}
