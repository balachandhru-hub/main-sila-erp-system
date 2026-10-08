using Buyer.Application.Features.Shared;
using Buyer.Application.Services;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetPurchaseOrders
{
    public class GetPurchaseOrdersQueryHandler : IRequestHandler<GetPurchaseOrdersQuery, List<PurchaseOrderListItemDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetPurchaseOrdersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<PurchaseOrderListItemDto>> Handle(GetPurchaseOrdersQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching purchase orders. OrganizationId: {request.OrganizationId}, Index: {request.Index}, Limit: {request.Limit}");

            BuyerBusinessProfile? buyer = _repository.BuyerBusinessProfile.FindFirstByCondition(
                x => x.OrganizationId == request.OrganizationId && x.IsActive);
            if (buyer == null)
            {
                _logger.LogError($"Buyer not found. OrganizationId: {request.OrganizationId}");
                throw new NotFoundCustomException("Buyer not found.", "The signed-in organization does not have a buyer profile.");
            }

            Guid buyerId = buyer.Id;
            string buyerName = buyer.OrganizationName;
            int index = request.Index < 0 ? 0 : request.Index;
            int limit = request.Limit <= 0 ? 20 : Math.Min(request.Limit, 100);
            List<PurchaseOrderListItemDto> result = await _repository.PurchaseOrder
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .OrderByDescending(x => x.OrderDate)
                .Skip(index)
                .Take(limit)
                .Select(x => new PurchaseOrderListItemDto
                {
                    Id = x.Id,
                    PoNumber = x.PoNumber,
                    SupplierId = x.SupplierId,
                    SupplierName = x.SupplierName,
                    BuyerName = buyerName,
                    BucketCode = x.BucketCode,
                    PlantCode = x.PlantCode,
                    Status = x.Status,
                    Currency = x.Currency,
                    TotalAmount = x.TotalAmount,
                    OrderDate = x.OrderDate,
                    ItemCount = x.Items.Count(item => item.IsActive),
                    ContractId = x.ContractId,
                    ContractNumber = x.PredefinedContract != null ? x.PredefinedContract.ContractNumber : null,
                    ErpPurchaseOrderId = x.ErpPurchaseOrderId,
                    SupplierErpSalesOrderNumber = x.SupplierErpSalesOrderNumber,
                    SourceType = x.SourceType
                })
                .ToListAsync(cancellationToken);

            // ERP hand-offs (buyer ERP and supplier ERP) of the orders created here: by a contract, a user or a weekly bucket.
            List<Guid> handedOffOrderIds = result
                .Where(x => x.SourceType == Common.PURCHASE_ORDER_SOURCE_CONTRACT || x.SourceType == Common.PURCHASE_ORDER_SOURCE_MANUAL || x.SourceType == Common.PURCHASE_ORDER_SOURCE_WEEKLY_BUCKET)
                .Select(x => x.Id)
                .ToList();
            if (handedOffOrderIds.Count > 0)
            {
                List<PurchaseDocumentIntegration> rows = await _repository.PurchaseDocumentIntegration
                    .FindByCondition(x => x.PurchaseOrderId != null && handedOffOrderIds.Contains(x.PurchaseOrderId.Value) && x.IsActive
                        && (x.IntegrationType == Common.ERP_OPERATION_PO_CREATE || x.IntegrationType == Common.ERP_OPERATION_SUPPLIER_SALES_ORDER_CREATE))
                    .ToListAsync(cancellationToken);
                foreach (PurchaseOrderListItemDto item in result.Where(x => handedOffOrderIds.Contains(x.Id)))
                {
                    PurchaseDocumentIntegration? buyerRow = rows.FirstOrDefault(x => x.PurchaseOrderId == item.Id && x.IntegrationType == Common.ERP_OPERATION_PO_CREATE);
                    PurchaseDocumentIntegration? supplierRow = rows.FirstOrDefault(x => x.PurchaseOrderId == item.Id && x.IntegrationType == Common.ERP_OPERATION_SUPPLIER_SALES_ORDER_CREATE);
                    item.ErpSyncStatus = PurchaseOrderErpProcessor.LegStatus(item.ErpPurchaseOrderId, buyerRow);
                    item.ErpSyncError = item.ErpSyncStatus == Common.PURCHASE_ORDER_ERP_FAILED || item.ErpSyncStatus == Common.PURCHASE_ORDER_ERP_UNKNOWN
                        ? buyerRow?.ErrorMessage
                        : null;
                    item.SupplierErpSyncStatus = PurchaseOrderErpProcessor.LegStatus(item.SupplierErpSalesOrderNumber, supplierRow);
                    item.SupplierErpSyncError = item.SupplierErpSyncStatus == Common.PURCHASE_ORDER_ERP_FAILED || item.SupplierErpSyncStatus == Common.PURCHASE_ORDER_ERP_UNKNOWN
                        ? supplierRow?.ErrorMessage
                        : null;
                    item.CanReprocess = PurchaseOrderErpProcessor.NeedsAttention(item.ErpSyncStatus) || PurchaseOrderErpProcessor.NeedsAttention(item.SupplierErpSyncStatus);
                }
            }

            _logger.LogInfo($"Purchase orders fetched. Count: {result.Count}, BuyerId: {buyerId}");
            return result;
        }
    }
}
