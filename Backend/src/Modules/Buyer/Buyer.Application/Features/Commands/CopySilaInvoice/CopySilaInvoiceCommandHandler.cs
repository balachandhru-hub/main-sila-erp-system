using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CopySilaInvoice
{
    public class CopySilaInvoiceCommandHandler : IRequestHandler<CopySilaInvoiceCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CopySilaInvoiceCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(CopySilaInvoiceCommand request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice? source = await _repository.Invoice.FindFirstByConditionAsync(x => x.Id == request.InvoiceId && x.BuyerId == buyer.Id && x.IsActive);
            if (source == null)
            {
                throw new NotFoundCustomException("Invoice not found.", "Choose an invoice from the list.");
            }

            List<InvoiceItem> items = await _repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == source.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            string number = await NextNumberAsync(buyer.Id, source.InvoiceNumber, cancellationToken);
            bool ready = !string.IsNullOrWhiteSpace(number)
                && source.InvoiceDate != null
                && source.GrossAmount != null
                && (source.SilaSupplierId != null || !string.IsNullOrWhiteSpace(source.SupplierName));
            Invoice copy = new Invoice
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                InvoiceNumber = number,
                SupplierId = source.SupplierId,
                SupplierName = source.SupplierName,
                InvoiceDate = source.InvoiceDate,
                Currency = source.Currency,
                GrossAmount = source.GrossAmount,
                PurchaseOrderId = source.PurchaseOrderId,
                PoNumber = source.PoNumber,
                FilePath = source.FilePath,
                FileName = source.FileName,
                Status = ready ? Common.SILA_INVOICE_REVIEWED : Common.SILA_INVOICE_UPLOADED,
                OcrText = source.OcrText,
                OcrConfidence = source.OcrConfidence,
                UploadedBy = request.UserId,
                SilaSupplierId = source.SilaSupplierId,
                InvoiceType = source.InvoiceType,
                NetAmount = source.NetAmount,
                TaxAmount = source.TaxAmount,
                SupplierTaxNumber = source.SupplierTaxNumber,
                PostingData = SilaInvoiceTracker.RetargetPostingData(source.PostingData, number),
                ErpPostingId = null,
                ContentHash = null,
                IsActive = true,
                CreatedBy = request.UserId,
                UpdatedBy = request.UserId,
                DateCreated = DateTime.UtcNow,
                DateUpdated = DateTime.UtcNow
            };
            _repository.Invoice.Create(copy);
            foreach (InvoiceItem item in items)
            {
                _repository.InvoiceItem.Create(new InvoiceItem
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = copy.Id,
                    LineNumber = item.LineNumber,
                    Description = item.Description,
                    Quantity = item.Quantity,
                    UnitPrice = item.UnitPrice,
                    Amount = item.Amount,
                    PurchaseOrderItemId = item.PurchaseOrderItemId,
                    Uom = item.Uom,
                    SupplierMaterialCode = item.SupplierMaterialCode,
                    TaxRate = item.TaxRate,
                    MatchStatus = item.MatchStatus,
                    IsActive = true,
                    CreatedBy = request.UserId,
                    UpdatedBy = request.UserId,
                    DateCreated = DateTime.UtcNow,
                    DateUpdated = DateTime.UtcNow
                });
            }

            await _repository.SaveAsync();
            _logger.LogInfo($"Invoice copied. SourceInvoiceId: {source.Id}, InvoiceId: {copy.Id}, Number: {number}");
            return copy.Id;
        }

        private async Task<string> NextNumberAsync(Guid buyerId, string? invoiceNumber, CancellationToken cancellationToken)
        {
            string root = string.IsNullOrWhiteSpace(invoiceNumber) ? "INVOICE" : invoiceNumber.Trim();
            if (root.Length > 80)
            {
                root = root[..80];
            }

            string candidate = root + "-COPY";
            for (int suffix = 2; suffix < 50; suffix++)
            {
                bool taken = await _repository.Invoice
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.InvoiceNumber == candidate)
                    .AnyAsync(cancellationToken);
                if (!taken)
                {
                    return candidate;
                }

                candidate = root + "-COPY-" + suffix;
            }

            return root + "-COPY-" + Guid.NewGuid().ToString("N")[..6];
        }
    }
}
