using Microsoft.EntityFrameworkCore;
using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaAdjustments
{
    /// <summary>Stock adjustments of the locations of the user, newest first, optionally by location and type.</summary>
    public class GetSilaAdjustmentsQueryHandler : IRequestHandler<GetSilaAdjustmentsQuery, List<SilaAdjustmentListItemDto>>
    {
        private static readonly string[] AdjustmentTypes =
        {
            Common.SILA_TXN_OPENING_STOCK, "WASTE", "DAMAGE", "BREAKAGE", "SPOILAGE", "EXPIRED", Common.SILA_TXN_MANUAL_ADJUSTMENT
        };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaAdjustmentsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaAdjustmentListItemDto>> Handle(GetSilaAdjustmentsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching stock adjustments. LocationId: {request.LocationId}, Type: {request.AdjustmentType}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);

            IQueryable<StockAdjustment> query = _repository.StockAdjustment.FindByCondition(x => x.BuyerId == buyer.Id
                && x.IsActive
                && locationIds.Contains(x.LocationId));
            if (request.LocationId != null)
            {
                Guid locationId = request.LocationId.Value;
                query = query.Where(x => x.LocationId == locationId);
            }

            if (!string.IsNullOrWhiteSpace(request.AdjustmentType))
            {
                string type = SilaInputRules.OneOf(_logger, request.AdjustmentType, AdjustmentTypes, "adjustment type");
                query = query.Where(x => x.AdjustmentType == type);
            }

            List<StockAdjustment> adjustments = await query
                .OrderByDescending(x => x.DateCreated)
                .ThenByDescending(x => x.Id)
                .Skip(SilaInputRules.Index(request.Index))
                .Take(SilaInputRules.Limit(request.Limit))
                .ToListAsync(cancellationToken);
            List<Guid> adjustmentIds = adjustments.Select(x => x.Id).ToList();
            Dictionary<Guid, int> lineCounts = await _repository.StockAdjustmentItem
                .FindByCondition(x => adjustmentIds.Contains(x.StockAdjustmentId) && x.IsActive)
                .GroupBy(x => x.StockAdjustmentId)
                .Select(x => new { Id = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.Id, x => x.Count, cancellationToken);
            Dictionary<Guid, string> locations = await SilaMovementLookup.GetLocationNamesAsync(
                _repository, buyer.Id, adjustments.Select(x => x.LocationId), cancellationToken);
            Dictionary<Guid, string> users = await SilaMovementLookup.GetUserNamesAsync(
                _identityApiClient, _logger, adjustments.Select(x => x.PostedBy), cancellationToken);

            List<SilaAdjustmentListItemDto> result = adjustments.Select(x => new SilaAdjustmentListItemDto
            {
                Id = x.Id,
                AdjustmentNumber = x.AdjustmentNumber,
                LocationId = x.LocationId,
                LocationName = locations.GetValueOrDefault(x.LocationId),
                AdjustmentType = x.AdjustmentType,
                Reason = x.Reason,
                PostedBy = x.PostedBy,
                PostedByName = SilaMovementLookup.NameOf(users, x.PostedBy),
                PostedOn = x.DateCreated,
                LineCount = lineCounts.GetValueOrDefault(x.Id)
            }).ToList();

            _logger.LogInfo($"Stock adjustments fetched. Count: {result.Count}");
            return result;
        }
    }
}
