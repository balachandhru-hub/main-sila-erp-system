using Buyer.Application.Contracts;
using Buyer.Domain.Dtos;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSupplierPurchaseOrders
{
    public class GetSupplierPurchaseOrdersQueryHandler : IRequestHandler<GetSupplierPurchaseOrdersQuery, List<PurchaseOrderListItemDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly ISupplierApiClient _supplierApiClient;

        public GetSupplierPurchaseOrdersQueryHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            ISupplierApiClient supplierApiClient)
        {
            _repository = repository;
            _logger = logger;
            _supplierApiClient = supplierApiClient;
        }

        public async Task<List<PurchaseOrderListItemDto>> Handle(GetSupplierPurchaseOrdersQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching purchase orders of the supplier. Index: {request.Index}, Limit: {request.Limit}");

            // The supplier is the one of the signed-in user, never one named by the request.
            Guid supplierId = await _supplierApiClient.GetSupplierId(cancellationToken);

            int index = request.Index < 0 ? 0 : request.Index;
            int limit = request.Limit <= 0 ? 20 : Math.Min(request.Limit, 100);
            List<PurchaseOrderListItemDto> result = await _repository.PurchaseOrder
                .FindByCondition(x => x.SupplierId == supplierId && x.IsActive)
                .OrderByDescending(x => x.OrderDate)
                .Skip(index)
                .Take(limit)
                .Select(x => new PurchaseOrderListItemDto
                {
                    Id = x.Id,
                    // The supplier sees the purchase order number of the buyer's ERP (the one their own ERP received) as the PO
                    // number. An order with none keeps the number of this system. The number of this system stays in LocalPoNumber.
                    PoNumber = x.ErpPurchaseOrderId != null && x.ErpPurchaseOrderId != "" ? x.ErpPurchaseOrderId : x.PoNumber,
                    LocalPoNumber = x.ErpPurchaseOrderId != null && x.ErpPurchaseOrderId != "" ? x.PoNumber : null,
                    SupplierId = x.SupplierId,
                    SupplierName = x.SupplierName,
                    BuyerName = x.BuyerBusinessProfile.OrganizationName,
                    BucketCode = x.BucketCode,
                    PlantCode = x.PlantCode,
                    Status = x.Status,
                    Currency = x.Currency,
                    TotalAmount = x.TotalAmount,
                    OrderDate = x.OrderDate,
                    ItemCount = x.Items.Count(item => item.IsActive),
                    // The numbers the supplier works with: the buyer ERP's order number (the one their ERP receives) and the
                    // order number their own ERP gave.
                    ErpPurchaseOrderId = x.ErpPurchaseOrderId,
                    SupplierErpSalesOrderNumber = x.SupplierErpSalesOrderNumber,
                    SourceType = x.SourceType
                })
                .ToListAsync(cancellationToken);

            _logger.LogInfo($"Purchase orders of the supplier fetched. Count: {result.Count}, SupplierId: {supplierId}");
            return result;
        }
    }
}
