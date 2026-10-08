using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaGoodsReceipt
{
    public class GetSilaGoodsReceiptQueryHandler : IRequestHandler<GetSilaGoodsReceiptQuery, SilaReceivingGrnDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaGoodsReceiptQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaReceivingGrnDetailDto> Handle(GetSilaGoodsReceiptQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching goods receipt. GoodsReceiptId: {request.GoodsReceiptId}, OrganizationId: {request.OrganizationId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            GoodsReceipt? receipt = await _repository.GoodsReceipt
                .FindByCondition(x => x.Id == request.GoodsReceiptId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (receipt == null)
            {
                _logger.LogError($"Goods receipt not found. GoodsReceiptId: {request.GoodsReceiptId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Goods receipt not found.", "Select a goods receipt of this organization.");
            }

            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, receipt.LocationId, cancellationToken);
            SilaReceivingGrnListItemDto header = (await SilaReceivingRules.ToGrnListAsync(_repository, new List<GoodsReceipt> { receipt }, cancellationToken))[0];
            List<GoodsReceiptItem> items = await _repository.GoodsReceiptItem
                .FindByCondition(x => x.GoodsReceiptId == receipt.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            InventoryErpPosting? posting = receipt.ErpPostingId == null
                ? null
                : await _repository.InventoryErpPosting.FindByCondition(x => x.Id == receipt.ErpPostingId.Value).FirstOrDefaultAsync(cancellationToken);

            SilaReceivingGrnDetailDto result = new SilaReceivingGrnDetailDto
            {
                Id = receipt.Id,
                GrnNumber = receipt.GrnNumber,
                PurchaseOrderId = receipt.PurchaseOrderId,
                PoNumber = receipt.PoNumber,
                SupplierName = header.SupplierName,
                LocationId = receipt.LocationId,
                LocationName = header.LocationName,
                InvoiceId = receipt.InvoiceId,
                InvoiceNumber = header.InvoiceNumber,
                DeliveryNote = receipt.DeliveryNote,
                Status = receipt.Status,
                ReceivedBy = receipt.ReceivedBy,
                ReceivedOn = receipt.DateCreated,
                ErpPosting = posting == null ? null : SilaReceivingRules.ToPostingDto(posting, header.LocationName),
                Items = items.Select(item => new SilaReceivingGrnItemDto
                {
                    Id = item.Id,
                    PurchaseOrderItemId = item.PurchaseOrderItemId,
                    MaterialId = item.MaterialId,
                    MaterialCode = item.MaterialCode,
                    MaterialName = item.MaterialName,
                    OrderedQty = item.OrderedQty,
                    ReceivedQty = item.ReceivedQty,
                    AcceptedQty = item.AcceptedQty,
                    RejectedQty = item.RejectedQty,
                    DamagedQty = item.DamagedQty,
                    Uom = item.Uom,
                    Stocked = item.MaterialId != null,
                    OpenQtyBefore = item.OpenQtyBefore,
                    InvoiceQty = item.InvoiceQty,
                    BatchNumber = item.BatchNumber,
                    ExpiryDate = item.ExpiryDate
                }).ToList()
            };

            _logger.LogInfo($"Goods receipt fetched. GoodsReceiptId: {receipt.Id}, Lines: {result.Items.Count}");
            return result;
        }
    }
}
