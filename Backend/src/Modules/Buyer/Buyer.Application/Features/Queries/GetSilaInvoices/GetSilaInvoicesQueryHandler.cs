using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInvoices
{
    public class GetSilaInvoicesQueryHandler : IRequestHandler<GetSilaInvoicesQuery, List<SilaInvoiceListItemDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaInvoicesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaInvoiceListItemDto>> Handle(GetSilaInvoicesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching invoices. OrganizationId: {request.OrganizationId}, Search: {request.Search}, Status: {request.Status}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            int index = request.Index < 0 ? 0 : request.Index;
            int limit = SilaInputRules.Limit(request.Limit, 20);

            IQueryable<Invoice> query = _repository.Invoice.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                string status = SilaInputRules.OneOf(_logger, request.Status, new[]
                {
                    Common.SILA_INVOICE_UPLOADED, Common.SILA_INVOICE_EXTRACTED, Common.SILA_INVOICE_OCR_FAILED,
                    Common.SILA_INVOICE_REVIEWED, Common.SILA_INVOICE_GRN_POSTED
                }, "invoice status");
                query = query.Where(x => x.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                query = query.Where(x => (x.InvoiceNumber != null && x.InvoiceNumber.Contains(search))
                    || (x.SupplierName != null && x.SupplierName.Contains(search))
                    || (x.PoNumber != null && x.PoNumber.Contains(search))
                    || x.FileName.Contains(search));
            }

            List<SilaInvoiceListItemDto> result = await query
                .OrderByDescending(x => x.DateCreated)
                .Skip(index)
                .Take(limit)
                .Select(x => new SilaInvoiceListItemDto
                {
                    Id = x.Id,
                    InvoiceNumber = x.InvoiceNumber,
                    SupplierId = x.SupplierId,
                    SupplierName = x.SupplierName,
                    InvoiceDate = x.InvoiceDate,
                    Currency = x.Currency,
                    GrossAmount = x.GrossAmount,
                    PurchaseOrderId = x.PurchaseOrderId,
                    PoNumber = x.PoNumber,
                    FileName = x.FileName,
                    Status = x.Status,
                    OcrConfidence = x.OcrConfidence,
                    UploadedOn = x.DateCreated,
                    InvoiceType = x.InvoiceType,
                    NetAmount = x.NetAmount,
                    TaxAmount = x.TaxAmount,
                    SupplierTaxNumber = x.SupplierTaxNumber,
                    GoodsReceiptApplicable = x.InvoiceType != SilaReceivingRules.INVOICE_SERVICE
                })
                .ToListAsync(cancellationToken);

            _logger.LogInfo($"Invoices fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}
