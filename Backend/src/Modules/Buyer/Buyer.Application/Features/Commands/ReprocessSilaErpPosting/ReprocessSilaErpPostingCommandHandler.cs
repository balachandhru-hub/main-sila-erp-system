using Buyer.Application.Features.Commands.PostPendingErpPostings;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.Extensions.Configuration;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReprocessSilaErpPosting
{
    public class ReprocessSilaErpPostingCommandHandler : IRequestHandler<ReprocessSilaErpPostingCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;
        private readonly IConfiguration _configuration;

        public ReprocessSilaErpPostingCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator, IConfiguration configuration)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
            _configuration = configuration;
        }

        public async Task<Guid> Handle(ReprocessSilaErpPostingCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Reprocessing ERP posting. PostingId: {request.PostingId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryErpPosting? posting = await _repository.InventoryErpPosting.FindFirstByConditionAsync(
                x => x.Id == request.PostingId && x.BuyerId == buyer.Id && x.IsActive);
            if (posting == null)
            {
                _logger.LogError($"ERP posting not found. PostingId: {request.PostingId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("ERP posting not found.", "Select an ERP posting of this organization.");
            }

            if (posting.Status == Common.SILA_POSTING_UNKNOWN)
            {
                _logger.LogError($"ERP posting is unknown and cannot be resent. PostingId: {posting.Id}");
                throw new BadRequestCustomException(
                    "Reconcile this posting.",
                    "SAP did not confirm whether the document was created. Reconcile it before anything is sent again.");
            }

            if (posting.Status == Common.SILA_POSTING_POSTED)
            {
                throw new BadRequestCustomException("Nothing to reprocess.", "This posting already completed in SAP and in SILA.");
            }

            if (SilaTrackerRules.ErpAlreadyAccepted(posting))
            {
                string? previous = posting.ErrorMessage;
                await SilaPostingRecovery.FinalizeLocalAsync(_repository, _logger, posting, request.UserId, previous, cancellationToken, _configuration[Common.BASE_FOLDER_PATH], _mediator, _configuration[SilaInvoiceAttachment.PUBLIC_BASE]);
                _logger.LogInfo($"ERP posting finalized locally. PostingId: {posting.Id}, Reference: {posting.ErpReference}");
                return posting.Id;
            }

            if (posting.Status != Common.SILA_POSTING_FAILED && posting.Status != Common.SILA_POSTING_SKIPPED)
            {
                _logger.LogError($"ERP posting cannot be reprocessed. PostingId: {posting.Id}, Status: {posting.Status}");
                throw new BadRequestCustomException("Posting cannot be reprocessed.", "Only a failed ERP call, or a local failure after SAP success, can be reprocessed.");
            }

            string? originalError = posting.ErrorMessage;
            posting.Status = Common.SILA_POSTING_PENDING;
            posting.ErrorMessage = null;
            SilaPostingRecovery.Record(_repository, posting, request.UserId, SilaTrackerRules.FROM_ERP, originalError, true, false, "ERP processing queued again. Receive is not repeated.");
            await _repository.SaveAsync();

            // Send step 2 (S4) immediately; stock was already updated when the GRN was posted.
            try
            {
                await _mediator.Send(new PostPendingErpPostingsCommand { BuyerId = buyer.Id, PostingId = posting.Id }, cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError($"Reprocess ERP send failed. PostingId: {posting.Id}, Error: {SilaLogText.Short(exception.Message)}");
            }

            _logger.LogInfo($"ERP posting reprocessed. PostingId: {posting.Id}, Reference: {posting.ReferenceNumber}");
            return posting.Id;
        }
    }
}
