using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DecideSilaCreditMemo
{
    public class DecideSilaCreditMemoCommandHandler : IRequestHandler<DecideSilaCreditMemoCommand, SilaCreditMemoDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;

        public DecideSilaCreditMemoCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
        }

        public async Task<SilaCreditMemoDetailDto> Handle(DecideSilaCreditMemoCommand request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            CreditMemo memo = await SilaCreditMemoRules.GetAsync(_repository, _logger, buyer.Id, request.CreditMemoId);
            if (memo.Status != Common.SILA_CREDIT_MEMO_PENDING_APPROVAL)
            {
                throw new SharedKernel.ExceptionHandler.BadRequestCustomException(
                    "Credit memo is not waiting for approval.",
                    "Submit the credit memo before approving it.");
            }

            List<int> versions = await _repository.SilaApprovalStep
                .FindByCondition(x => x.ReferenceType == Common.SILA_REF_CREDIT_MEMO && x.ReferenceId == memo.Id && x.IsActive)
                .Select(x => x.Version)
                .ToListAsync(cancellationToken);
            int version = versions.Count == 0 ? 1 : versions.Max();
            ApprovalDecision decision = await SilaApprovals.DecideAsync(
                _repository, _logger, Common.SILA_REF_CREDIT_MEMO, memo.Id, version, request.UserId, request.Request.Approve, request.Request.Comment,
                cancellationToken, SilaAccess.HasFullAccess(request.RoleId));
            if (decision.Outcome == SilaApprovals.OUTCOME_REJECTED)
            {
                memo.Status = Common.SILA_CREDIT_MEMO_APPROVAL_REJECTED;
                _repository.CreditMemo.Update(memo);
                await _repository.SaveAsync();
                return await SilaCreditMemoRules.ToDetailAsync(_repository, memo, cancellationToken);
            }

            if (decision.Outcome != SilaApprovals.OUTCOME_APPROVED)
            {
                await _repository.SaveAsync();
                return await SilaCreditMemoRules.ToDetailAsync(_repository, memo, cancellationToken);
            }

            memo.Status = Common.SILA_CREDIT_MEMO_READY_TO_POST;
            _repository.CreditMemo.Update(memo);
            await _repository.SaveAsync();
            await SilaCreditMemoPosting.ContinueAsync(_repository, _mediator, buyer, memo, request.UserId, cancellationToken);
            memo = await SilaCreditMemoRules.GetAsync(_repository, _logger, buyer.Id, request.CreditMemoId);
            return await SilaCreditMemoRules.ToDetailAsync(_repository, memo, cancellationToken);
        }
    }
}
