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

            await SilaCreditMemoPosting.ContinueAsync(_repository, _mediator, buyer, memo, request.UserId, cancellationToken);
            memo = await SilaCreditMemoRules.GetAsync(_repository, _logger, buyer.Id, request.CreditMemoId);
            return await SilaCreditMemoRules.ToDetailAsync(_repository, memo, cancellationToken);
        }
    }
}
