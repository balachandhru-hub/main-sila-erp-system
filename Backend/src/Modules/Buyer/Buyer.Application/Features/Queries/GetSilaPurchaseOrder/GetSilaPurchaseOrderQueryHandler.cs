using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;

namespace Buyer.Application.Features.Queries.GetSilaPurchaseOrder
{
    public class GetSilaPurchaseOrderQueryHandler : IRequestHandler<GetSilaPurchaseOrderQuery, SilaReceivingPoDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaPurchaseOrderQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaReceivingPoDetailDto> Handle(GetSilaPurchaseOrderQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching purchase order for receiving. PurchaseOrderId: {request.PurchaseOrderId}, OrganizationId: {request.OrganizationId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PurchaseOrder purchaseOrder = await SilaReceivingRules.GetPurchaseOrderAsync(_repository, _logger, buyer.Id, request.PurchaseOrderId);
            List<PurchaseOrderItem> items = await _repository.PurchaseOrderItem
                .FindByCondition(x => x.PurchaseOrderId == purchaseOrder.Id && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);
            Dictionary<string, MaterialEntity> materials = await SilaReceivingRules.GetMaterialsByCodeAsync(
                _repository, buyer.Id, items.Select(x => x.MaterialCode), cancellationToken);

            MaterialEntity? MaterialOf(PurchaseOrderItem item) =>
                !string.IsNullOrWhiteSpace(item.MaterialCode) && materials.TryGetValue(item.MaterialCode.Trim(), out MaterialEntity? found) ? found : null;

            SilaReceivingPoDetailDto result = new SilaReceivingPoDetailDto
            {
                Id = purchaseOrder.Id,
                PoNumber = purchaseOrder.PoNumber,
                SupplierId = purchaseOrder.SupplierId,
                SupplierName = purchaseOrder.SupplierName,
                OrderDate = purchaseOrder.OrderDate,
                Status = purchaseOrder.Status,
                CompanyCode = purchaseOrder.CompanyCode,
                PlantCode = purchaseOrder.PlantCode,
                Currency = purchaseOrder.Currency,
                TotalAmount = purchaseOrder.TotalAmount,
                EntityCode = purchaseOrder.CompanyCode,
                DeliveryDate = purchaseOrder.DeliveryDate,
                TotalOrderedQuantity = items.Sum(x => x.Quantity),
                SourceSystem = purchaseOrder.SourceSystem ?? purchaseOrder.SourceType,
                Lines = items.Select(item => new SilaReceivingPoLineDto
                {
                    Id = item.Id,
                    LineNumber = item.LineNumber,
                    MaterialCode = item.MaterialCode,
                    MaterialId = !string.IsNullOrWhiteSpace(item.MaterialCode) && materials.TryGetValue(item.MaterialCode.Trim(), out MaterialEntity? material) ? material.Id : null,
                    ProductName = item.ProductName,
                    Uom = item.UnitOfMeasure,
                    UnitPrice = item.UnitPrice,
                    OrderedQty = item.Quantity,
                    ReceivedQty = item.ReceivedQuantity,
                    OpenQty = SilaReceivingRules.OpenQuantity(item),
                    Status = SilaReceivingRules.LineStatus(item),
                    GoodsReceiptExpected = SilaReceivingRules.GoodsReceiptExpected(item, MaterialOf(item)),
                    ItemNumber = SilaReceivingRules.ItemNumber(item),
                    BatchManaged = MaterialOf(item)?.BatchManaged ?? false,
                    ExpiryManaged = MaterialOf(item)?.ExpiryManaged ?? false,
                    ShelfLifeDays = MaterialOf(item)?.ShelfLifeDays
                }).ToList()
            };

            _logger.LogInfo($"Purchase order for receiving fetched. PurchaseOrderId: {purchaseOrder.Id}, Lines: {result.Lines.Count}");
            return result;
        }
    }
}
