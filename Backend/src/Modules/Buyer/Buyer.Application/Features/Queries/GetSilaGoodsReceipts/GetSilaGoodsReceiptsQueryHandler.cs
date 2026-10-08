using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaGoodsReceipts
{
    public class GetSilaGoodsReceiptsQueryHandler : IRequestHandler<GetSilaGoodsReceiptsQuery, List<SilaReceivingGrnListItemDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaGoodsReceiptsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaReceivingGrnListItemDto>> Handle(GetSilaGoodsReceiptsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching goods receipts. OrganizationId: {request.OrganizationId}, Search: {request.Search}, From: {request.FromDate}, To: {request.ToDate}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            int index = request.Index < 0 ? 0 : request.Index;
            int limit = SilaInputRules.Limit(request.Limit, 20);

            IQueryable<GoodsReceipt> query = _repository.GoodsReceipt
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && locationIds.Contains(x.LocationId));
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                query = query.Where(x => x.GrnNumber.Contains(search)
                    || x.PoNumber.Contains(search)
                    || (x.DeliveryNote != null && x.DeliveryNote.Contains(search)));
            }

            if (request.FromDate != null)
            {
                DateTime from = request.FromDate.Value.Date;
                query = query.Where(x => x.DateCreated >= from);
            }

            if (request.ToDate != null)
            {
                DateTime to = request.ToDate.Value.Date.AddDays(1);
                query = query.Where(x => x.DateCreated < to);
            }

            List<GoodsReceipt> receipts = await query
                .OrderByDescending(x => x.DateCreated)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);
            List<SilaReceivingGrnListItemDto> result = await SilaReceivingRules.ToGrnListAsync(_repository, receipts, cancellationToken);

            _logger.LogInfo($"Goods receipts fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}
