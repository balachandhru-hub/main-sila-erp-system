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
                if (request.Status.Equals(Common.SILA_INVOICE_POSTED, StringComparison.OrdinalIgnoreCase))
                {
                    string[] posted = SilaInvoiceLifecycle.PostedStatuses;
                    query = query.Where(x => posted.Contains(x.Status));
                }
                else
                {
                    string status = SilaInputRules.OneOf(_logger, request.Status, new[]
                    {
                        Common.SILA_INVOICE_UPLOADED, Common.SILA_INVOICE_EXTRACTED, Common.SILA_INVOICE_OCR_FAILED,
                        Common.SILA_INVOICE_REVIEWED, Common.SILA_INVOICE_GRN_POSTED, Common.SILA_INVOICE_READY,
                        Common.SILA_INVOICE_PENDING_APPROVAL, Common.SILA_INVOICE_APPROVED,
                        Common.SILA_INVOICE_POSTING_FAILED, Common.SILA_INVOICE_AWAITING_PAYMENT,
                        Common.SILA_INVOICE_PARTIALLY_PAID, Common.SILA_INVOICE_PAID, Common.SILA_INVOICE_OVERDUE,
                        Common.SILA_INVOICE_LOCAL_FAILED, SilaOcrSettings.INVOICE_REVIEW_REQUIRED
                    }, "invoice status");
                    query = query.Where(x => x.Status == status);
                }
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                List<Guid> erpInvoiceIds = await _repository.InventoryErpPosting
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive
                        && x.ReferenceType == Common.SILA_REF_INVOICE
                        && x.ErpReference != null && x.ErpReference.Contains(search))
                    .Select(x => x.ReferenceId)
                    .ToListAsync(cancellationToken);
                query = query.Where(x => (x.InvoiceNumber != null && x.InvoiceNumber.Contains(search))
                    || (x.SupplierName != null && x.SupplierName.Contains(search))
                    || (x.PoNumber != null && x.PoNumber.Contains(search))
                    || x.FileName.Contains(search)
                    || erpInvoiceIds.Contains(x.Id));
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
                    CreationType = x.CreationType,
                    CompanyCode = x.CompanyCode,
                    NetAmount = x.NetAmount,
                    TaxAmount = x.TaxAmount,
                    SupplierTaxNumber = x.SupplierTaxNumber,
                    GoodsReceiptApplicable = x.InvoiceType != SilaReceivingRules.INVOICE_SERVICE
                })
                .ToListAsync(cancellationToken);

            List<Guid> invoiceIds = result.Select(x => x.Id).ToList();
            List<Invoice> rows = invoiceIds.Count == 0
                ? new List<Invoice>()
                : await _repository.Invoice.FindByCondition(x => invoiceIds.Contains(x.Id)).ToListAsync(cancellationToken);
            List<Guid> postingIds = rows.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            Dictionary<Guid, InventoryErpPosting> postings = postingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await _repository.InventoryErpPosting.FindByCondition(x => postingIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, Invoice> byId = rows.ToDictionary(x => x.Id);
            foreach (SilaInvoiceListItemDto item in result)
            {
                if (!byId.TryGetValue(item.Id, out Invoice? invoice) || invoice.ErpPostingId == null)
                {
                    continue;
                }

                if (!postings.TryGetValue(invoice.ErpPostingId.Value, out InventoryErpPosting? posting))
                {
                    continue;
                }

                if (await SilaInvoicePosting.ApplyStoredSuccessAsync(_repository, invoice, posting, cancellationToken))
                {
                    await _repository.SaveAsync();
                }

                item.ErpReference = posting.ErpReference ?? SilaInvoicePosting.ReadSupplierInvoice(posting.ErpResponsePayload);
                item.FiscalYear = SilaInvoicePosting.ReadFiscalYear(posting.ErpResponsePayload);
                item.PostingDate = posting.PostedOn;
            }

            _logger.LogInfo($"Invoices fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}
