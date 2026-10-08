using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReprocessSilaErpPosting
{
    public class ReprocessSilaErpPostingCommandHandler : IRequestHandler<ReprocessSilaErpPostingCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ReprocessSilaErpPostingCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
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

            if (posting.Status != Common.SILA_POSTING_FAILED && posting.Status != Common.SILA_POSTING_SKIPPED)
            {
                _logger.LogError($"ERP posting cannot be reprocessed. PostingId: {posting.Id}, Status: {posting.Status}");
                throw new BadRequestCustomException("Posting cannot be reprocessed.", "Only FAILED or SKIPPED postings can be sent again.");
            }

            posting.Status = Common.SILA_POSTING_PENDING;
            posting.Attempts = 0;
            posting.ErrorMessage = null;
            await _repository.SaveAsync();

            _logger.LogInfo($"ERP posting queued again. PostingId: {posting.Id}, Reference: {posting.ReferenceNumber}");
            return posting.Id;
        }
    }
}
