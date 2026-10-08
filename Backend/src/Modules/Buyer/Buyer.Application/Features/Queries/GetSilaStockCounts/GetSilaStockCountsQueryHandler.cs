using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaStockCounts
{
    public class GetSilaStockCountsQueryHandler : IRequestHandler<GetSilaStockCountsQuery, List<SilaStockCountListItemDto>>
    {
        /// <summary>The number of lines of a count in one line status.</summary>
        private sealed class LineStatusCount
        {
            public Guid StockCountId { get; set; }
            public string Status { get; set; } = string.Empty;
            public int Count { get; set; }
            public decimal Value { get; set; }
        }

        private static readonly string[] STATUSES =
        {
            Common.SILA_COUNT_IN_PROGRESS, Common.SILA_COUNT_SUBMITTED, Common.SILA_COUNT_ENQUIRY_PENDING,
            Common.SILA_COUNT_POSTED, Common.SILA_COUNT_CANCELLED
        };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaStockCountsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaStockCountListItemDto>> Handle(GetSilaStockCountsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching stock counts. Status: {request.Status}, LocationId: {request.LocationId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            IQueryable<StockCount> query = _repository.StockCount
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && locationIds.Contains(x.LocationId));
            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                string status = SilaInputRules.OneOf(_logger, request.Status, STATUSES, "stock count status");
                query = query.Where(x => x.Status == status);
            }

            if (request.LocationId != null)
            {
                query = query.Where(x => x.LocationId == request.LocationId.Value);
            }

            List<StockCount> counts = await query
                .OrderByDescending(x => x.DateCreated)
                .Skip(SilaInputRules.Index(request.Index))
                .Take(SilaInputRules.Limit(request.Limit))
                .ToListAsync(cancellationToken);
            List<Guid> countIds = counts.Select(x => x.Id).ToList();
            List<Guid> countLocationIds = counts.Select(x => x.LocationId).Distinct().ToList();
            List<LineStatusCount> lineStatuses = await _repository.StockCountItem
                .FindByCondition(x => countIds.Contains(x.StockCountId) && x.IsActive)
                .GroupBy(x => new { x.StockCountId, x.Status })
                .Select(x => new LineStatusCount
                {
                    StockCountId = x.Key.StockCountId,
                    Status = x.Key.Status,
                    Count = x.Count(),
                    Value = x.Sum(i => i.VarianceValue ?? 0)
                })
                .ToListAsync(cancellationToken);
            SilaCountContext context = await SilaCountContext.LoadAsync(
                _repository, _identityApiClient, _logger, buyer.Id, countLocationIds, counts.Select(x => x.CreatedBy), cancellationToken);
            string? currency = await SilaCountContext.CurrencyAsync(_repository, buyer.Id, null, cancellationToken);

            List<SilaStockCountListItemDto> result = counts.Select(count =>
            {
                Dictionary<string, int> statuses = lineStatuses
                    .Where(x => x.StockCountId == count.Id)
                    .ToDictionary(x => x.Status, x => x.Count);
                bool canSee = SilaStockCountRules.CanSeeSystemQty(count, request.RoleId);
                return new SilaStockCountListItemDto
                {
                    Id = count.Id,
                    CountNumber = count.CountNumber,
                    LocationId = count.LocationId,
                    LocationName = context.Locations.TryGetValue(count.LocationId, out InventoryLocation? location) ? location.LocationName : null,
                    CountType = count.CountType,
                    BlindCount = count.BlindCount,
                    Status = count.Status,
                    TotalItems = statuses.Values.Sum(),
                    CountedItems = statuses.Where(x => x.Key != Common.SILA_COUNT_LINE_NOT_COUNTED).Sum(x => x.Value),
                    ShortageItems = canSee ? statuses.GetValueOrDefault(Common.SILA_COUNT_LINE_SHORTAGE) : 0,
                    SurplusItems = canSee ? statuses.GetValueOrDefault(Common.SILA_COUNT_LINE_SURPLUS) : 0,
                    DateCreated = count.DateCreated,
                    SubmittedOn = count.SubmittedOn,
                    ApprovedOn = count.ApprovedOn,
                    PropertyId = context.PropertyIdOf(count.LocationId),
                    PropertyName = context.PropertyOf(count.LocationId),
                    BusinessDate = count.BusinessDate,
                    MatchedItems = canSee ? statuses.GetValueOrDefault(Common.SILA_COUNT_LINE_MATCHED) : 0,
                    ShortageValue = canSee
                        ? -lineStatuses.Where(x => x.StockCountId == count.Id && x.Status == Common.SILA_COUNT_LINE_SHORTAGE).Sum(x => x.Value)
                        : null,
                    Currency = currency,
                    CreatedBy = count.CreatedBy,
                    CreatedByName = context.NameOf(count.CreatedBy)
                };
            }).ToList();

            _logger.LogInfo($"Stock counts fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}
