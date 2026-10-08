using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaErpPostings
{
    public class GetSilaErpPostingsQueryHandler : IRequestHandler<GetSilaErpPostingsQuery, List<SilaErpPostingListItemDto>>
    {
        private const int SEARCH_LENGTH = 100;
        private static readonly string[] Statuses =
        {
            Common.SILA_POSTING_PENDING, Common.SILA_POSTING_POSTED, Common.SILA_POSTING_FAILED, Common.SILA_POSTING_SKIPPED, Common.SILA_POSTING_UNKNOWN
        };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaErpPostingsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaErpPostingListItemDto>> Handle(GetSilaErpPostingsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching ERP postings. OrganizationId: {request.OrganizationId}, Status: {request.Status}, Search: {request.Search}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            int index = request.Index < 0 ? 0 : request.Index;
            int limit = SilaInputRules.Limit(request.Limit, 20);
            SilaInputRules.MaxLength(_logger, request.Search, SEARCH_LENGTH, "Search");

            IQueryable<InventoryErpPosting> query = _repository.InventoryErpPosting.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                string status = SilaInputRules.OneOf(_logger, request.Status, Statuses, "posting status");
                query = query.Where(x => x.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                query = query.Where(x => x.ReferenceNumber.Contains(search) || (x.ErpReference != null && x.ErpReference.Contains(search)));
            }

            List<InventoryErpPosting> postings = await query
                .OrderByDescending(x => x.DateCreated)
                .ThenByDescending(x => x.Id)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);
            List<Guid> locationIds = postings.Where(x => x.LocationId != null).Select(x => x.LocationId!.Value).Distinct().ToList();
            Dictionary<Guid, string> locations = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && locationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.LocationName, cancellationToken);

            List<SilaErpPostingListItemDto> result = postings
                .Select(posting => SilaReceivingRules.ToPostingDto(
                    posting,
                    posting.LocationId != null && locations.TryGetValue(posting.LocationId.Value, out string? name) ? name : null))
                .ToList();

            _logger.LogInfo($"ERP postings fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}
