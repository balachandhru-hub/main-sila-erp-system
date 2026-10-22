using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaCreditMemo
{
    public class CreateSilaCreditMemoCommandHandler : IRequestHandler<CreateSilaCreditMemoCommand, SilaCreditMemoDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateSilaCreditMemoCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaCreditMemoDetailDto> Handle(CreateSilaCreditMemoCommand request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice? invoice = await SilaCreditMemoRules.ResolveReferenceInvoiceAsync(
                _repository, buyer.Id, request.Request.ReferenceInvoiceId, request.Request.InvoiceNumber, request.Request.ErpInvoiceId, cancellationToken);
            if (invoice == null)
            {
                throw new BadRequestCustomException(
                    "Reference invoice was not resolved.",
                    "Look up the original SILA invoice number or ERP invoice ID before creating a credit memo.");
            }

            invoice = await SilaCreditMemoRules.RequirePostedInvoiceAsync(_repository, _logger, buyer.Id, invoice.Id, cancellationToken);
            SilaCreditMemoReferenceInvoiceDto reference = await SilaCreditMemoRules.ToReferenceAsync(_repository, invoice, cancellationToken);
            List<SilaCreditMemoEligibleLineDto> eligible = await SilaCreditMemoRules.EligibleLinesAsync(_repository, invoice, null, cancellationToken);
            List<SilaCreditMemoLineWriteDto> included = SilaCreditMemoRules.IncludedWrites(eligible, request.Request.Lines);

            CreditMemo memo = new CreditMemo
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                ReferenceInvoiceId = invoice.Id,
                CreditMemoNumber = await DocumentNumber.NextAsync(_repository, buyer.Id, DocumentNumber.CREDIT_MEMO, 6, cancellationToken),
                CreditMemoReference = string.IsNullOrWhiteSpace(request.Request.CreditMemoReference)
                    ? null
                    : request.Request.CreditMemoReference.Trim(),
                ReferenceSupplierInvoiceNumber = invoice.InvoiceNumber,
                ReferenceErpInvoiceId = reference.ErpInvoiceId,
                ReferenceFiscalYear = reference.FiscalYear,
                SupplierId = invoice.SupplierId,
                SilaSupplierId = invoice.SilaSupplierId,
                SupplierName = invoice.SupplierName,
                PurchaseOrderId = invoice.PurchaseOrderId,
                PoNumber = invoice.PoNumber,
                CompanyCode = reference.CompanyCode ?? invoice.CompanyCode,
                Currency = reference.Currency ?? invoice.Currency,
                DocumentDate = SilaCreditMemoRules.TransactionDate(request.Request.DocumentDate),
                PostingDate = SilaCreditMemoRules.TransactionDate(request.Request.PostingDate ?? request.Request.DocumentDate),
                TaxCalculationDate = SilaCreditMemoRules.TransactionDate(
                    request.Request.TaxCalculationDate ?? request.Request.PostingDate ?? request.Request.DocumentDate),
                Reason = SilaCreditMemoRules.ResolveHeaderText(request.Request.HeaderText, request.Request.Reason, invoice.InvoiceNumber),
                Status = Common.SILA_CREDIT_MEMO_DRAFT,
                CreatedByUserId = request.UserId,
                IsActive = true
            };
            memo.CreditMemoReference ??= memo.CreditMemoNumber;
            int lineNumber = 0;
            decimal gross = 0;
            List<CreditMemoItem> lines = new List<CreditMemoItem>();
            foreach (SilaCreditMemoLineWriteDto write in included)
            {
                SilaCreditMemoEligibleLineDto source = eligible.First(x => x.InvoiceLineId == write.InvoiceLineId);
                lineNumber++;
                gross += write.Amount ?? 0;
                lines.Add(new CreditMemoItem
                {
                    Id = Guid.NewGuid(),
                    CreditMemoId = memo.Id,
                    ReferenceInvoiceLineId = write.InvoiceLineId,
                    LineNumber = lineNumber,
                    PoNumber = source.PoNumber,
                    PoItem = source.PoItem,
                    Material = source.Material,
                    Description = source.Description,
                    Quantity = write.Quantity,
                    Uom = source.Uom,
                    Amount = write.Amount,
                    TaxCode = source.TaxCode,
                    Reason = write.Reason,
                    IsActive = true
                });
            }

            memo.GrossAmount = gross;
            _repository.CreditMemo.Create(memo);
            foreach (CreditMemoItem item in lines)
            {
                _repository.CreditMemoItem.Create(item);
            }

            SilaCreditMemoPosting.Remember(_repository, memo, request.UserId, SilaCreditMemoPosting.ACTION_CREATED, memo.CreditMemoNumber);
            SilaCreditMemoPosting.RememberInvoice(_repository, memo, request.UserId, SilaCreditMemoPosting.ACTION_CREATED, "Credit Memo Created. " + memo.CreditMemoNumber);
            await SilaCreditMemoPostingData.StoreAsync(_repository, memo, invoice, lines, request.UserId, cancellationToken);
            await _repository.SaveAsync();
            return await SilaCreditMemoRules.ToDetailAsync(_repository, memo, cancellationToken);
        }
    }
}
