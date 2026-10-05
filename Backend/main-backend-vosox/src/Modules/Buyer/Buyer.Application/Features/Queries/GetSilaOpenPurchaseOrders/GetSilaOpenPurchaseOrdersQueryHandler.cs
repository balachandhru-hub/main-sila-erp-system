using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaOpenPurchaseOrders
{
    public class GetSilaOpenPurchaseOrdersQueryHandler : IRequestHandler<GetSilaOpenPurchaseOrdersQuery, List<SilaReceivingPoListItemDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaOpenPurchaseOrdersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaReceivingPoListItemDto>> Handle(GetSilaOpenPurchaseOrdersQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching open purchase orders. OrganizationId: {request.OrganizationId}, Search: {request.Search}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            int index = request.Index < 0 ? 0 : request.Index;
            int limit = SilaInputRules.Limit(request.Limit, 20);
            string? search = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim();

            IQueryable<PurchaseOrder> query = _repository.PurchaseOrder
                .FindByCondition(x => x.BuyerId == buyer.Id
                    && x.IsActive
                    && x.Status != SilaReceivingRules.PO_CANCELLED
                    && x.Status != Common.SILA_PO_RECEIVED
                    && x.Items.Any(item => item.IsActive && item.Quantity - item.ReceivedQuantity > 0));
            if (search != null)
            {
                query = query.Where(x => x.PoNumber.Contains(search) || (x.SupplierName != null && x.SupplierName.Contains(search)));
            }

            List<SilaReceivingPoListItemDto> result = await query
                .OrderByDescending(x => x.OrderDate)
                .Skip(index)
                .Take(limit)
                .Select(x => new SilaReceivingPoListItemDto
                {
                    Id = x.Id,
                    PoNumber = x.PoNumber,
                    SupplierId = x.SupplierId,
                    SupplierName = x.SupplierName,
                    OrderDate = x.OrderDate,
                    Status = x.Status,
                    PlantCode = x.PlantCode,
                    Currency = x.Currency,
                    TotalAmount = x.TotalAmount,
                    EntityCode = x.CompanyCode,
                    DeliveryDate = x.DeliveryDate,
                    TotalOrderedQuantity = x.Items.Where(item => item.IsActive).Sum(item => item.Quantity),
                    LineCount = x.Items.Count(item => item.IsActive),
                    OpenLineCount = x.Items.Count(item => item.IsActive && item.Quantity - item.ReceivedQuantity > 0)
                })
                .ToListAsync(cancellationToken);

            _logger.LogInfo($"Open purchase orders fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}
