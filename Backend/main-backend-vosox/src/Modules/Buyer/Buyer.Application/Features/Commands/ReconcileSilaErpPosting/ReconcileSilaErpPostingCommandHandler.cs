using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReconcileSilaErpPosting
{
    /// <summary>
    /// A posting whose ERP call ended without a clear answer (UNKNOWN) is never resent automatically: the user checks the
    /// ERP and tells whether the document exists. Posted: POSTED with the ERP number. Not posted: PENDING, sent by the next run.
    /// </summary>
    public class ReconcileSilaErpPostingCommandHandler : IRequestHandler<ReconcileSilaErpPostingCommand, Guid>
    {
        private const int REFERENCE_LENGTH = 100;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ReconcileSilaErpPostingCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(ReconcileSilaErpPostingCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Reconciling ERP posting. PostingId: {request.PostingId}, Posted: {request.Request.Posted}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            string? erpReference = string.IsNullOrWhiteSpace(request.Request.ErpReference) ? null : request.Request.ErpReference.Trim();
            if (erpReference != null && erpReference.Length > REFERENCE_LENGTH)
            {
                _logger.LogError($"ERP reference is too long. PostingId: {request.PostingId}, Length: {erpReference.Length}");
                throw new BadRequestCustomException("ERP reference is too long.", $"Enter the ERP document number (at most {REFERENCE_LENGTH} characters).");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryErpPosting? posting = await _repository.InventoryErpPosting.FindFirstByConditionAsync(
                x => x.Id == request.PostingId && x.BuyerId == buyer.Id && x.IsActive);
            if (posting == null)
            {
                _logger.LogError($"ERP posting not found. PostingId: {request.PostingId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("ERP posting not found.", "Select an ERP posting of this organization.");
            }

            if (posting.Status != Common.SILA_POSTING_UNKNOWN)
            {
                _logger.LogError($"ERP posting is not waiting for reconciliation. PostingId: {posting.Id}, Status: {posting.Status}");
                throw new BadRequestCustomException("Nothing to reconcile.", $"Only postings with status UNKNOWN are reconciled; this one is {posting.Status}.");
            }

            if (request.Request.Posted)
            {
                posting.Status = Common.SILA_POSTING_POSTED;
                posting.ErpReference = erpReference;
                posting.PostedOn = DateTime.UtcNow;
                posting.ErrorMessage = null;
                if (posting.ReferenceType == Common.SILA_REF_POS_SALE)
                {
                    await MarkPosSalesPostedAsync(posting, cancellationToken);
                }
            }
            else
            {
                // The ERP does not have it: send it again (fresh attempts, same idempotency key).
                posting.Status = Common.SILA_POSTING_PENDING;
                posting.Attempts = 0;
                posting.ErrorMessage = "Reconciled: not found in the ERP, sending again.";
            }

            await _repository.SaveAsync();
            _logger.LogInfo($"ERP posting reconciled. PostingId: {posting.Id}, Status: {posting.Status}");
            return posting.Id;
        }

        private async Task MarkPosSalesPostedAsync(InventoryErpPosting posting, CancellationToken cancellationToken)
        {
            List<PosSalesTransaction> sales = await _repository.PosSalesTransaction
                .FindByCondition(x => x.BuyerId == posting.BuyerId && (x.ErpPostingId == posting.Id || x.Id == posting.ReferenceId))
                .ToListAsync(cancellationToken);
            foreach (PosSalesTransaction sale in sales)
            {
                sale.Status = Common.SILA_POS_POSTED;
                sale.FailedStep = null;
                sale.FailureMessage = null;
                _repository.PosSalesTransaction.Update(sale);
            }
        }
    }
}
