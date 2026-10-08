using Microsoft.EntityFrameworkCore;
using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaGoodsIssues
{
    /// <summary>Goods issues from or to the locations of the user, newest first, optionally for one location.</summary>
    public class GetSilaGoodsIssuesQueryHandler : IRequestHandler<GetSilaGoodsIssuesQuery, List<SilaGoodsIssueListItemDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaGoodsIssuesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaGoodsIssueListItemDto>> Handle(GetSilaGoodsIssuesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching goods issues. LocationId: {request.LocationId}, UserId: {request.UserId}, Index: {request.Index}, Limit: {request.Limit}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);

            IQueryable<GoodsIssue> query = _repository.GoodsIssue.FindByCondition(x => x.BuyerId == buyer.Id
                && x.IsActive
                && (locationIds.Contains(x.FromLocationId) || locationIds.Contains(x.ToLocationId)));
            if (request.LocationId != null)
            {
                Guid locationId = request.LocationId.Value;
                query = query.Where(x => x.FromLocationId == locationId || x.ToLocationId == locationId);
            }

            List<GoodsIssue> issues = await query
                .OrderByDescending(x => x.DateCreated)
                .ThenByDescending(x => x.Id)
                .Skip(SilaInputRules.Index(request.Index))
                .Take(SilaInputRules.Limit(request.Limit))
                .ToListAsync(cancellationToken);
            List<Guid> issueIds = issues.Select(x => x.Id).ToList();
            Dictionary<Guid, int> lineCounts = await _repository.GoodsIssueItem
                .FindByCondition(x => issueIds.Contains(x.GoodsIssueId) && x.IsActive)
                .GroupBy(x => x.GoodsIssueId)
                .Select(x => new { Id = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.Id, x => x.Count, cancellationToken);
            List<Guid> bucketIds = issues.Where(x => x.WeeklyBucketId != null).Select(x => x.WeeklyBucketId!.Value).Distinct().ToList();
            Dictionary<Guid, string> buckets = await _repository.WeeklyBucket
                .FindByCondition(x => x.BuyerId == buyer.Id && bucketIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.BucketCode, cancellationToken);
            Dictionary<Guid, string> locations = await SilaMovementLookup.GetLocationNamesAsync(
                _repository, buyer.Id, issues.SelectMany(x => new[] { x.FromLocationId, x.ToLocationId }), cancellationToken);
            Dictionary<Guid, string> users = await SilaMovementLookup.GetUserNamesAsync(
                _identityApiClient, _logger, issues.Select(x => x.IssuedBy), cancellationToken);

            List<SilaGoodsIssueListItemDto> result = issues.Select(x => new SilaGoodsIssueListItemDto
            {
                Id = x.Id,
                IssueNumber = x.IssueNumber,
                FromLocationId = x.FromLocationId,
                FromLocationName = locations.GetValueOrDefault(x.FromLocationId),
                ToLocationId = x.ToLocationId,
                ToLocationName = locations.GetValueOrDefault(x.ToLocationId),
                WeeklyBucketId = x.WeeklyBucketId,
                BucketCode = x.WeeklyBucketId == null ? null : buckets.GetValueOrDefault(x.WeeklyBucketId.Value),
                IssuedBy = x.IssuedBy,
                IssuedByName = SilaMovementLookup.NameOf(users, x.IssuedBy),
                IssuedOn = x.DateCreated,
                LineCount = lineCounts.GetValueOrDefault(x.Id)
            }).ToList();

            _logger.LogInfo($"Goods issues fetched. Count: {result.Count}");
            return result;
        }
    }
}
