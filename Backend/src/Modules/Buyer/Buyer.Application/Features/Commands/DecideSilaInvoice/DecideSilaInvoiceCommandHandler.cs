using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DecideSilaInvoice
{
    public class DecideSilaInvoiceCommandHandler : IRequestHandler<DecideSilaInvoiceCommand, SilaInvoiceDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;
        private readonly IIntegrationHttpExecutor _executor;

        public DecideSilaInvoiceCommandHandler(
            IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator, IIntegrationHttpExecutor executor)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
            _executor = executor;
        }

        public async Task<SilaInvoiceDetailDto> Handle(DecideSilaInvoiceCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deciding invoice approval. InvoiceId: {request.InvoiceId}, Approve: {request.Request.Approve}, UserId: {request.UserId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            if (invoice.Status != Common.SILA_INVOICE_PENDING_APPROVAL)
            {
                _logger.LogError($"Invoice is not pending approval. InvoiceId: {invoice.Id}, Status: {invoice.Status}");
                throw new SharedKernel.ExceptionHandler.BadRequestCustomException("Invoice is not waiting for approval.", "Submit the invoice before approving it.");
            }

            List<int> versions = await _repository.SilaApprovalStep
                .FindByCondition(x => x.ReferenceType == Common.SILA_REF_INVOICE && x.ReferenceId == invoice.Id && x.IsActive)
                .Select(x => x.Version)
                .ToListAsync(cancellationToken);
            int version = versions.Count == 0 ? SilaInvoiceLifecycle.VERSION : versions.Max();
            ApprovalDecision decision = await SilaApprovals.DecideAsync(
                _repository, _logger, Common.SILA_REF_INVOICE, invoice.Id, version, request.UserId, request.Request.Approve, request.Request.Comment,
                cancellationToken, SilaAccess.HasFullAccess(request.RoleId));
            if (decision.Outcome == SilaApprovals.OUTCOME_REJECTED)
            {
                invoice.Status = Common.SILA_INVOICE_APPROVAL_REJECTED;
                _repository.Invoice.Update(invoice);
                await _repository.SaveAsync();
                _logger.LogInfo($"Invoice approval rejected. InvoiceId: {invoice.Id}");
                return await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
            }

            if (decision.Outcome != SilaApprovals.OUTCOME_APPROVED)
            {
                await _repository.SaveAsync();
                _logger.LogInfo($"Invoice approval recorded. InvoiceId: {invoice.Id}, Level: {decision.Level}");
                return await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
            }

            invoice.Status = Common.SILA_INVOICE_APPROVED;
            _repository.Invoice.Update(invoice);
            await _repository.SaveAsync();
            await SilaInvoicePosting.ContinueAsync(_repository, _logger, _mediator, _executor, buyer, invoice, request.UserId, cancellationToken);
            invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            _logger.LogInfo($"Invoice approved and submitted to posting. InvoiceId: {invoice.Id}, Status: {invoice.Status}");
            return await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
        }
    }
}
