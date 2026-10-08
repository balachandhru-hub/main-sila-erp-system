using Microsoft.EntityFrameworkCore;
using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaGoodsIssue
{
    public class GetSilaGoodsIssueQueryHandler : IRequestHandler<GetSilaGoodsIssueQuery, SilaGoodsIssueDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaGoodsIssueQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<SilaGoodsIssueDetailDto> Handle(GetSilaGoodsIssueQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching goods issue. GoodsIssueId: {request.GoodsIssueId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            GoodsIssue? issue = await _repository.GoodsIssue
                .FindByCondition(x => x.Id == request.GoodsIssueId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (issue == null)
            {
                _logger.LogError($"Goods issue not found. GoodsIssueId: {request.GoodsIssueId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Goods issue not found.", "Open a goods issue of this organization.");
            }

            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            if (!locationIds.Contains(issue.FromLocationId) && !locationIds.Contains(issue.ToLocationId))
            {
                _logger.LogError($"User has no access to the goods issue. GoodsIssueId: {issue.Id}, UserId: {request.UserId}");
                throw new ForBiddenCustomException("No access to this goods issue.", "Ask your administrator to assign you to one of its locations.");
            }

            List<GoodsIssueItem> items = await _repository.GoodsIssueItem
                .FindByCondition(x => x.GoodsIssueId == issue.Id && x.IsActive)
                .OrderBy(x => x.MaterialCode)
                .ToListAsync(cancellationToken);
            string? bucketCode = issue.WeeklyBucketId == null
                ? null
                : await _repository.WeeklyBucket
                    .FindByCondition(x => x.Id == issue.WeeklyBucketId.Value && x.BuyerId == buyer.Id)
                    .Select(x => x.BucketCode)
                    .FirstOrDefaultAsync(cancellationToken);
            Dictionary<Guid, string> locations = await SilaMovementLookup.GetLocationNamesAsync(
                _repository, buyer.Id, new[] { issue.FromLocationId, issue.ToLocationId }, cancellationToken);
            Dictionary<Guid, string> users = await SilaMovementLookup.GetUserNamesAsync(
                _identityApiClient, _logger, new[] { issue.IssuedBy }, cancellationToken);

            _logger.LogInfo($"Goods issue fetched. GoodsIssueId: {issue.Id}, Lines: {items.Count}");
            return new SilaGoodsIssueDetailDto
            {
                Id = issue.Id,
                IssueNumber = issue.IssueNumber,
                FromLocationId = issue.FromLocationId,
                FromLocationName = locations.GetValueOrDefault(issue.FromLocationId),
                ToLocationId = issue.ToLocationId,
                ToLocationName = locations.GetValueOrDefault(issue.ToLocationId),
                WeeklyBucketId = issue.WeeklyBucketId,
                BucketCode = bucketCode,
                IssuedBy = issue.IssuedBy,
                IssuedByName = SilaMovementLookup.NameOf(users, issue.IssuedBy),
                IssuedOn = issue.DateCreated,
                Comment = issue.Comment,
                Items = items.Select(x => new SilaGoodsIssueItemDto
                {
                    Id = x.Id,
                    MaterialId = x.MaterialId,
                    MaterialCode = x.MaterialCode,
                    MaterialName = x.MaterialName,
                    Quantity = x.Quantity,
                    Uom = x.Uom,
                    BaseQuantity = x.BaseQuantity
                }).ToList()
            };
        }
    }
}
