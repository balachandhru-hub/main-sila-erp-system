using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SubmitSilaCreditMemo
{
    public class SubmitSilaCreditMemoCommandHandler : IRequestHandler<SubmitSilaCreditMemoCommand, SilaCreditMemoDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;

        public SubmitSilaCreditMemoCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
        }

        public async Task<SilaCreditMemoDetailDto> Handle(SubmitSilaCreditMemoCommand request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            CreditMemo memo = await SilaCreditMemoRules.GetAsync(_repository, _logger, buyer.Id, request.CreditMemoId);
            InventoryErpPosting? posting = memo.ErpPostingId == null
                ? null
                : await _repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == memo.ErpPostingId && x.BuyerId == buyer.Id);
            if (SilaCreditMemoLifecycle.IsUnknown(memo.Status, posting?.Status))
            {
                throw new BadRequestCustomException(
                    "Reconcile this credit memo.",
                    "SAP did not confirm whether the credit memo was created. Reconcile it before anything is sent again.");
            }

            if (posting != null && (SilaTrackerRules.ErpAlreadyAccepted(posting) || posting.Status == Common.SILA_POSTING_POSTED))
            {
                throw new ConflictCustomException("Credit memo is already posted.", "SAP already accepted this credit memo. It will not be posted again.");
            }

            Invoice invoice = await SilaCreditMemoRules.RequirePostedInvoiceAsync(_repository, _logger, buyer.Id, memo.ReferenceInvoiceId, cancellationToken);
            List<CreditMemoItem> items = await _repository.CreditMemoItem
                .FindByCondition(x => x.CreditMemoId == memo.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            List<SilaCreditMemoEligibleLineDto> eligible = await SilaCreditMemoRules.EligibleLinesAsync(
                _repository, invoice, memo.Id, cancellationToken);
            List<SilaCreditMemoLineWriteDto> writes = items
                .Where(x => x.ReferenceInvoiceLineId != null)
                .Select(x => new SilaCreditMemoLineWriteDto
                {
                    InvoiceLineId = x.ReferenceInvoiceLineId!.Value,
                    Quantity = x.Quantity,
                    Amount = x.Amount,
                    Reason = x.Reason
                })
                .ToList();
            if (writes.Count == 0)
            {
                throw new BadRequestCustomException("Credit memo has no lines.", "Enter a credit quantity or amount on at least one line.");
            }

            SilaCreditMemoRules.GuardQuantities(eligible, writes);
            if (request.Retry)
            {
                if (SilaCreditMemoPostingData.Read(memo.PostingData) == null)
                {
                    throw new BadRequestCustomException(
                        "Stored credit memo posting data is missing.",
                        "Retry uses the existing prepared credit memo data. It does not rebuild the original invoice.");
                }
            }
            else
            {
                await SilaCreditMemoPostingData.StoreAsync(_repository, memo, invoice, items, request.UserId, cancellationToken);
                await _repository.SaveAsync();
            }

            bool approved = await SilaCreditMemoLifecycle.ApprovalCompleteAsync(_repository, memo.Id, cancellationToken);
            if (!approved && await SilaCreditMemoLifecycle.ApprovalConfiguredAsync(_repository, buyer.Id, cancellationToken))
            {
                List<int> versions = await _repository.SilaApprovalStep
                    .FindByCondition(x => x.ReferenceType == Common.SILA_REF_CREDIT_MEMO && x.ReferenceId == memo.Id && x.IsActive)
                    .Select(x => x.Version)
                    .ToListAsync(cancellationToken);
                await SilaApprovals.StartAsync(
                    _repository, _logger, buyer.Id, Common.SILA_APPROVAL_TYPE_CREDIT_MEMO, Common.SILA_REF_CREDIT_MEMO, memo.Id,
                    versions.Count == 0 ? 1 : versions.Max() + 1,
                    new ApprovalScope { CompanyCode = memo.CompanyCode ?? invoice.CompanyCode },
                    cancellationToken);
                memo.Status = Common.SILA_CREDIT_MEMO_PENDING_APPROVAL;
                _repository.CreditMemo.Update(memo);
                await _repository.SaveAsync();
                return await SilaCreditMemoRules.ToDetailAsync(_repository, memo, cancellationToken);
            }

            await SilaCreditMemoPosting.ContinueAsync(_repository, _mediator, buyer, memo, request.UserId, cancellationToken);
            memo = await SilaCreditMemoRules.GetAsync(_repository, _logger, buyer.Id, request.CreditMemoId);
            return await SilaCreditMemoRules.ToDetailAsync(_repository, memo, cancellationToken);
        }
    }
}
