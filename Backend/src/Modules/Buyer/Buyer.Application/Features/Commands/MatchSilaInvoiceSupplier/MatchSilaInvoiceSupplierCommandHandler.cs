using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.MatchSilaInvoiceSupplier
{
    public class MatchSilaInvoiceSupplierCommandHandler : IRequestHandler<MatchSilaInvoiceSupplierCommand, SilaInvoiceDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public MatchSilaInvoiceSupplierCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInvoiceDetailDto> Handle(MatchSilaInvoiceSupplierCommand request, CancellationToken cancellationToken)
        {
            SilaInvoiceMatchSupplierDto input = request.Request;
            _logger.LogInfo($"Matching invoice supplier. InvoiceId: {request.InvoiceId}, SilaSupplierId: {input.SilaSupplierId}, SupplierId: {input.SupplierId}");
            bool master = input.SilaSupplierId != null && input.SilaSupplierId != Guid.Empty;
            bool fromOrders = input.SupplierId != null && input.SupplierId != Guid.Empty;
            if (master == fromOrders)
            {
                _logger.LogError($"Invoice supplier choice is ambiguous. InvoiceId: {request.InvoiceId}");
                throw new BadRequestCustomException("Choose one supplier.", "Send either a Supplier Master supplier or a purchase order supplier.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            if (invoice.Status == Common.SILA_INVOICE_GRN_POSTED)
            {
                _logger.LogError($"Invoice already received; supplier cannot change. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Invoice already received.", "Goods were received against this invoice; its supplier can no longer change.");
            }

            if (master)
            {
                SilaSupplier? supplier = await _repository.SilaSupplier
                    .FindByCondition(x => x.Id == input.SilaSupplierId!.Value && x.BuyerId == buyer.Id && x.IsActive)
                    .FirstOrDefaultAsync(cancellationToken);
                if (supplier == null)
                {
                    _logger.LogError($"Supplier not found. SilaSupplierId: {input.SilaSupplierId}, BuyerId: {buyer.Id}");
                    throw new NotFoundCustomException("Supplier not found.", "Select a supplier of the Supplier Master.");
                }

                invoice.SilaSupplierId = supplier.Id;
                invoice.SupplierId = SilaPurchaseOrderSync.SupplierIdOf(supplier);
                invoice.SupplierName = supplier.Name;
            }
            else
            {
                Guid supplierId = input.SupplierId!.Value;
                string? name = await _repository.PurchaseOrder
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.SupplierId == supplierId)
                    .OrderByDescending(x => x.OrderDate)
                    .Select(x => x.SupplierName)
                    .FirstOrDefaultAsync(cancellationToken);
                if (name == null)
                {
                    _logger.LogError($"Purchase order supplier not found. SupplierId: {supplierId}, BuyerId: {buyer.Id}");
                    throw new NotFoundCustomException("Supplier not found.", "Select a supplier of your purchase orders.");
                }

                invoice.SupplierId = supplierId;
                invoice.SupplierName = name;
                invoice.SilaSupplierId = await _repository.SilaSupplier
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && (x.Id == supplierId || x.SupplierOrganizationId == supplierId))
                    .Select(x => (Guid?)x.Id)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            await UnlinkOtherSupplierOrderAsync(invoice, cancellationToken);
            await _repository.SaveAsync();
            SilaInvoiceDetailDto detail = await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
            _logger.LogInfo($"Invoice supplier matched. InvoiceId: {invoice.Id}, SupplierName: {invoice.SupplierName}");
            return detail;
        }

        // A purchase order of another supplier no longer fits the invoice: it is unlinked with its line matches.
        private async Task UnlinkOtherSupplierOrderAsync(Invoice invoice, CancellationToken cancellationToken)
        {
            if (invoice.PurchaseOrderId == null)
            {
                return;
            }

            Guid? orderSupplier = await _repository.PurchaseOrder
                .FindByCondition(x => x.Id == invoice.PurchaseOrderId.Value)
                .Select(x => (Guid?)x.SupplierId)
                .FirstOrDefaultAsync(cancellationToken);
            List<Guid> keys = await SilaInvoiceMatching.SupplierKeysAsync(_repository, invoice, cancellationToken);
            if (orderSupplier != null && keys.Contains(orderSupplier.Value))
            {
                return;
            }

            invoice.PurchaseOrderId = null;
            invoice.PoNumber = null;
            List<InvoiceItem> items = await _repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive && x.PurchaseOrderItemId != null)
                .ToListAsync(cancellationToken);
            foreach (InvoiceItem item in items)
            {
                item.PurchaseOrderItemId = null;
                _repository.InvoiceItem.Update(item);
            }
        }
    }
}
