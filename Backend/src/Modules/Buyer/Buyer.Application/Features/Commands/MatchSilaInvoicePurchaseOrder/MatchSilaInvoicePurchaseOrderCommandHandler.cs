using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.MatchSilaInvoicePurchaseOrder
{
    public class MatchSilaInvoicePurchaseOrderCommandHandler : IRequestHandler<MatchSilaInvoicePurchaseOrderCommand, SilaInvoiceDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public MatchSilaInvoicePurchaseOrderCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInvoiceDetailDto> Handle(MatchSilaInvoicePurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Matching invoice purchase order. InvoiceId: {request.InvoiceId}, PurchaseOrderId: {request.Request.PurchaseOrderId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            if (invoice.Status == Common.SILA_INVOICE_GRN_POSTED)
            {
                _logger.LogError($"Invoice already received; purchase order cannot change. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Invoice already received.", "Goods were received against this invoice; its purchase order can no longer change.");
            }

            PurchaseOrder purchaseOrder = await SilaReceivingRules.GetPurchaseOrderAsync(_repository, _logger, buyer.Id, request.Request.PurchaseOrderId);
            List<PurchaseOrderItem> poItems = await _repository.PurchaseOrderItem
                .FindByCondition(x => x.PurchaseOrderId == purchaseOrder.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            if (SilaReceivingRules.IsClosed(purchaseOrder) || poItems.All(x => SilaReceivingRules.OpenQuantity(x) <= 0))
            {
                _logger.LogError($"Purchase order is not open. PurchaseOrderId: {purchaseOrder.Id}, Status: {purchaseOrder.Status}");
                throw new BadRequestCustomException("Purchase order is not open.", $"Purchase order {purchaseOrder.PoNumber} is {purchaseOrder.Status} with nothing left to receive.");
            }

            List<Guid> keys = await SilaInvoiceMatching.SupplierKeysAsync(_repository, invoice, cancellationToken);
            if (keys.Count > 0 && !keys.Contains(purchaseOrder.SupplierId))
            {
                _logger.LogError($"Purchase order of another supplier. InvoiceId: {invoice.Id}, PurchaseOrderId: {purchaseOrder.Id}");
                throw new BadRequestCustomException(
                    "Purchase order of another supplier.",
                    $"Purchase order {purchaseOrder.PoNumber} is from {purchaseOrder.SupplierName}; match the invoice supplier first if it is wrong.");
            }

            invoice.PurchaseOrderId = purchaseOrder.Id;
            invoice.PoNumber = purchaseOrder.PoNumber;
            if (keys.Count == 0)
            {
                invoice.SupplierId = purchaseOrder.SupplierId;
                invoice.SupplierName = purchaseOrder.SupplierName ?? invoice.SupplierName;
                invoice.SilaSupplierId = await _repository.SilaSupplier
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && (x.Id == purchaseOrder.SupplierId || x.SupplierOrganizationId == purchaseOrder.SupplierId))
                    .Select(x => (Guid?)x.Id)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            // The lines are matched again against the new purchase order.
            List<InvoiceItem> items = await _repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            foreach (InvoiceItem item in items)
            {
                item.PurchaseOrderItemId = SilaInvoiceMatching.MatchLine(item.Description, poItems);
                _repository.InvoiceItem.Update(item);
            }

            await _repository.SaveAsync();
            SilaInvoiceDetailDto detail = await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
            _logger.LogInfo($"Invoice purchase order matched. InvoiceId: {invoice.Id}, PoNumber: {purchaseOrder.PoNumber}, MatchedLines: {items.Count(x => x.PurchaseOrderItemId != null)}");
            return detail;
        }
    }
}
