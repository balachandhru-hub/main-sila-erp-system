using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UpdateSilaCreditMemo
{
    public class UpdateSilaCreditMemoCommandHandler : IRequestHandler<UpdateSilaCreditMemoCommand, SilaCreditMemoDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public UpdateSilaCreditMemoCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaCreditMemoDetailDto> Handle(UpdateSilaCreditMemoCommand request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            CreditMemo memo = await SilaCreditMemoRules.GetAsync(_repository, _logger, buyer.Id, request.CreditMemoId);
            if (!SilaCreditMemoLifecycle.CanSubmit(memo.Status))
            {
                throw new BadRequestCustomException("Credit memo cannot be edited.", "Only a draft or failed credit memo can be changed.");
            }

            Invoice invoice = await SilaCreditMemoRules.RequirePostedInvoiceAsync(_repository, _logger, buyer.Id, memo.ReferenceInvoiceId, cancellationToken);
            List<SilaCreditMemoEligibleLineDto> eligible = await SilaCreditMemoRules.EligibleLinesAsync(_repository, invoice, memo.Id, cancellationToken);
            SilaCreditMemoRules.GuardQuantities(eligible, request.Request.Lines);
            List<SilaCreditMemoLineWriteDto> included = request.Request.Lines
                .Where(x => (x.Quantity ?? 0) > 0 || (x.Amount ?? 0) > 0)
                .ToList();
            if (included.Count == 0)
            {
                throw new BadRequestCustomException("Credit memo has no lines.", "Enter a credit quantity or amount on at least one line.");
            }

            List<CreditMemoItem> existing = await _repository.CreditMemoItem
                .FindByCondition(x => x.CreditMemoId == memo.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            foreach (CreditMemoItem item in existing)
            {
                item.IsActive = false;
                _repository.CreditMemoItem.Update(item);
            }

            memo.CreditMemoReference = string.IsNullOrWhiteSpace(request.Request.CreditMemoReference)
                ? memo.CreditMemoReference ?? memo.CreditMemoNumber
                : request.Request.CreditMemoReference.Trim();
            memo.DocumentDate = request.Request.DocumentDate ?? memo.DocumentDate;
            memo.PostingDate = request.Request.PostingDate ?? memo.PostingDate;
            memo.TaxCalculationDate = request.Request.TaxCalculationDate ?? memo.TaxCalculationDate;
            memo.Reason = request.Request.Reason ?? memo.Reason;
            memo.Status = Common.SILA_CREDIT_MEMO_DRAFT;
            memo.PostingData = null;
            int lineNumber = 0;
            decimal gross = 0;
            foreach (SilaCreditMemoLineWriteDto write in included)
            {
                SilaCreditMemoEligibleLineDto source = eligible.First(x => x.InvoiceLineId == write.InvoiceLineId);
                lineNumber++;
                gross += write.Amount ?? 0;
                CreditMemoItem item = new CreditMemoItem
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
                    Reason = write.Reason ?? memo.Reason,
                    IsActive = true
                };
                _repository.CreditMemoItem.Create(item);
            }

            memo.GrossAmount = gross;
            _repository.CreditMemo.Update(memo);
            await _repository.SaveAsync();
            return await SilaCreditMemoRules.ToDetailAsync(_repository, memo, cancellationToken);
        }
    }
}
