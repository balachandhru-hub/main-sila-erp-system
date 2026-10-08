using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UpdateSilaInvoice
{
    public class UpdateSilaInvoiceCommandHandler : IRequestHandler<UpdateSilaInvoiceCommand, SilaInvoiceDetailDto>
    {
        private const int MAX_LINES = 500;
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public UpdateSilaInvoiceCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInvoiceDetailDto> Handle(UpdateSilaInvoiceCommand request, CancellationToken cancellationToken)
        {
            SilaInvoiceWriteDto input = request.Request;
            _logger.LogInfo($"Saving reviewed invoice. InvoiceId: {request.InvoiceId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            if (invoice.Status == Common.SILA_INVOICE_GRN_POSTED)
            {
                _logger.LogError($"Invoice already has a goods receipt. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Invoice already received.", "Goods were received against this invoice; it can no longer be changed.");
            }

            List<SilaInvoiceItemDto> lines = input.Items ?? new List<SilaInvoiceItemDto>();
            if (lines.Any(x => string.IsNullOrWhiteSpace(x.Description)))
            {
                _logger.LogError($"Invoice line without description. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Line description is required.", "Enter a description on every invoice line, or remove the line.");
            }

            if (input.GrossAmount < 0 || lines.Any(x => x.Quantity < 0 || x.UnitPrice < 0))
            {
                _logger.LogError($"Negative invoice amount. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Invalid amount.", "Amounts and quantities cannot be negative.");
            }

            ValidateInput(input, lines);

            PurchaseOrder? purchaseOrder = input.PurchaseOrderId == null || input.PurchaseOrderId == Guid.Empty
                ? null
                : await SilaReceivingRules.GetPurchaseOrderAsync(_repository, _logger, buyer.Id, input.PurchaseOrderId.Value);
            List<Guid> poItemIds = purchaseOrder == null
                ? new List<Guid>()
                : await _repository.PurchaseOrderItem.FindByCondition(x => x.PurchaseOrderId == purchaseOrder.Id && x.IsActive).Select(x => x.Id).ToListAsync(cancellationToken);
            if (lines.Any(x => x.PurchaseOrderItemId != null && !poItemIds.Contains(x.PurchaseOrderItemId.Value)))
            {
                _logger.LogError($"Invoice line linked to a line of another purchase order. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Purchase order line not found.", "Link invoice lines only to lines of the selected purchase order.");
            }

            string? invoiceNumber = string.IsNullOrWhiteSpace(input.InvoiceNumber) ? null : input.InvoiceNumber.Trim();
            Guid? supplierId = input.SupplierId ?? purchaseOrder?.SupplierId;
            string? supplierName = string.IsNullOrWhiteSpace(input.SupplierName) ? purchaseOrder?.SupplierName : input.SupplierName.Trim();
            await EnsureNotDuplicateAsync(invoice.Id, buyer.Id, invoiceNumber, supplierId, supplierName, cancellationToken);

            // The Supplier Master row: the one sent, or the current one unless the supplier name changed.
            if (input.SilaSupplierId != null && input.SilaSupplierId != Guid.Empty)
            {
                Guid silaSupplierId = input.SilaSupplierId.Value;
                bool known = await _repository.SilaSupplier
                    .FindByCondition(x => x.Id == silaSupplierId && x.BuyerId == buyer.Id && x.IsActive)
                    .AnyAsync(cancellationToken);
                if (!known)
                {
                    _logger.LogError($"Invoice supplier not found. SilaSupplierId: {silaSupplierId}, BuyerId: {buyer.Id}");
                    throw new NotFoundCustomException("Supplier not found.", "Select a supplier of the Supplier Master.");
                }

                invoice.SilaSupplierId = silaSupplierId;
            }
            else if (!string.Equals(invoice.SupplierName, supplierName, StringComparison.OrdinalIgnoreCase))
            {
                invoice.SilaSupplierId = null;
            }

            invoice.InvoiceNumber = invoiceNumber;
            invoice.SupplierId = supplierId;
            invoice.SupplierName = supplierName;
            invoice.InvoiceDate = input.InvoiceDate?.Date;
            invoice.Currency = string.IsNullOrWhiteSpace(input.Currency) ? null : input.Currency.Trim().ToUpperInvariant();
            invoice.GrossAmount = input.GrossAmount;
            if (input.InvoiceType != null)
            {
                string? type = SilaInvoiceApply.InvoiceType(input.InvoiceType);
                if (type == null)
                {
                    _logger.LogError($"Invoice type is invalid. InvoiceId: {invoice.Id}");
                    throw new BadRequestCustomException("Invalid invoice type.", "Choose MATERIAL, SERVICE or MIXED.");
                }

                invoice.InvoiceType = type;
            }

            if (input.NetAmount < 0 || input.TaxAmount < 0)
            {
                _logger.LogError($"Negative invoice net or tax amount. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Invalid amount.", "Net and tax amounts cannot be negative.");
            }

            SilaInputRules.MaxLength(_logger, input.SupplierTaxNumber, SilaInputRules.CODE_LENGTH, "supplier tax number");
            invoice.NetAmount = input.NetAmount ?? invoice.NetAmount;
            invoice.TaxAmount = input.TaxAmount ?? invoice.TaxAmount;
            if (input.SupplierTaxNumber != null)
            {
                invoice.SupplierTaxNumber = string.IsNullOrWhiteSpace(input.SupplierTaxNumber) ? null : input.SupplierTaxNumber.Trim();
            }
            invoice.PurchaseOrderId = purchaseOrder?.Id;
            invoice.PoNumber = purchaseOrder?.PoNumber;
            invoice.Status = Common.SILA_INVOICE_REVIEWED;

            await SilaReceivingRules.DeactivateInvoiceItemsAsync(_repository, invoice.Id, cancellationToken);
            int lineNumber = 0;
            foreach (SilaInvoiceItemDto line in lines)
            {
                lineNumber++;
                _repository.InvoiceItem.Create(new InvoiceItem
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = invoice.Id,
                    LineNumber = lineNumber,
                    Description = line.Description.Trim(),
                    Quantity = line.Quantity,
                    UnitPrice = line.UnitPrice,
                    Amount = line.Amount ?? (line.Quantity != null && line.UnitPrice != null ? line.Quantity * line.UnitPrice : null),
                    PurchaseOrderItemId = line.PurchaseOrderItemId,
                    Uom = string.IsNullOrWhiteSpace(line.Uom) ? null : line.Uom.Trim().ToUpperInvariant(),
                    SupplierMaterialCode = string.IsNullOrWhiteSpace(line.SupplierMaterialCode) ? null : line.SupplierMaterialCode.Trim(),
                    TaxRate = line.TaxRate,
                    MatchStatus = line.PurchaseOrderItemId == null ? SilaReceivingRules.MATCH_UNMATCHED : SilaReceivingRules.MATCH_MATCHED,
                    IsActive = true
                });
            }

            await _repository.SaveAsync();
            SilaInvoiceDetailDto detail = await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
            _logger.LogInfo($"Invoice reviewed. InvoiceId: {invoice.Id}, Lines: {detail.Items.Count}");
            return detail;
        }

        // Lengths, ranges and the invoice date of the reviewed invoice.
        private void ValidateInput(SilaInvoiceWriteDto input, List<SilaInvoiceItemDto> lines)
        {
            SilaInputRules.MaxLength(_logger, input.InvoiceNumber, SilaInputRules.CODE_LENGTH, "invoice number");
            SilaInputRules.MaxLength(_logger, input.SupplierName, SilaInputRules.NAME_LENGTH, "supplier name");
            if (!string.IsNullOrWhiteSpace(input.Currency) && !SilaMaterialRules.IsCurrency(input.Currency.Trim().ToUpperInvariant()))
            {
                _logger.LogError($"Invalid invoice currency. Currency: {input.Currency}");
                throw new BadRequestCustomException("Currency is not valid.", "Enter a 3-letter ISO currency code, e.g. AED.");
            }

            SilaInputRules.SaneDate(_logger, input.InvoiceDate, "invoice date", 5, 1);
            SilaInputRules.Price(_logger, input.GrossAmount, "gross amount");
            if (lines.Count > MAX_LINES)
            {
                _logger.LogError($"Too many invoice lines. Lines: {lines.Count}");
                throw new BadRequestCustomException("Too many invoice lines.", $"An invoice can have at most {MAX_LINES} lines.");
            }

            foreach (SilaInvoiceItemDto line in lines)
            {
                SilaInputRules.MaxLength(_logger, line.Description, SilaInputRules.DESCRIPTION_LENGTH, "line description");
                SilaInputRules.MaxLength(_logger, line.Uom, SilaInputRules.CODE_LENGTH, "line unit");
                SilaInputRules.MaxLength(_logger, line.SupplierMaterialCode, SilaInputRules.CODE_LENGTH, "supplier material code");
                if (line.TaxRate is < 0 or > 100)
                {
                    _logger.LogError($"Invoice line tax rate out of range. TaxRate: {line.TaxRate}");
                    throw new BadRequestCustomException("Invalid tax rate.", "Enter a tax rate between 0 and 100 percent.");
                }

                SilaInputRules.Price(_logger, line.Quantity, "line quantity");
                SilaInputRules.Price(_logger, line.UnitPrice, "unit price");
                SilaInputRules.Price(_logger, line.Amount, "line amount");
            }
        }

        // One supplier invoice number is entered once per buyer.
        private async Task EnsureNotDuplicateAsync(Guid invoiceId, Guid buyerId, string? invoiceNumber, Guid? supplierId, string? supplierName, CancellationToken cancellationToken)
        {
            if (invoiceNumber == null || (supplierId == null && supplierName == null))
            {
                return;
            }

            bool duplicate = await _repository.Invoice
                .FindByCondition(x => x.BuyerId == buyerId
                    && x.IsActive
                    && x.Id != invoiceId
                    && x.InvoiceNumber == invoiceNumber
                    && ((supplierId != null && x.SupplierId == supplierId) || (supplierName != null && x.SupplierName == supplierName)))
                .AnyAsync(cancellationToken);
            if (duplicate)
            {
                _logger.LogError($"Duplicate supplier invoice. InvoiceNumber: {invoiceNumber}, SupplierId: {supplierId}, SupplierName: {supplierName}");
                throw new ConflictCustomException("Duplicate invoice.", $"Invoice {invoiceNumber} of this supplier was already entered.");
            }
        }
    }
}
