using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DiscardSilaPosBatch
{
    /// <summary>
    /// Discards a PREVIEW batch: its RECEIVED lines are deleted (nothing was deducted for them, and the unique transaction/line
    /// index would otherwise treat a corrected upload as duplicates) and the batch is deactivated.
    /// </summary>
    public class DiscardSilaPosBatchCommandHandler : IRequestHandler<DiscardSilaPosBatchCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DiscardSilaPosBatchCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DiscardSilaPosBatchCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Discarding POS batch. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, BatchId: {request.BatchId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSalesBatch? batch = await _repository.PosSalesBatch.FindFirstByConditionAsync(
                x => x.Id == request.BatchId && x.BuyerId == buyer.Id && x.IsActive);
            if (batch == null)
            {
                _logger.LogError($"POS batch not found. BatchId: {request.BatchId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Sales batch not found.", "Select a sales batch of this organization.");
            }

            if (batch.Status != Common.SILA_POS_BATCH_PREVIEW)
            {
                _logger.LogError($"POS batch cannot be discarded. BatchId: {batch.Id}, Status: {batch.Status}");
                throw new BadRequestCustomException("A processed batch cannot be discarded.", "Only an upload that was previewed and not processed can be discarded.");
            }

            List<PosSalesTransaction> lines = await _repository.PosSalesTransaction
                .FindByCondition(x => x.BatchId == batch.Id && x.BuyerId == buyer.Id && x.Status == Common.SILA_POS_RECEIVED)
                .ToListAsync(cancellationToken);
            _repository.PosSalesTransaction.DeleteRange(lines);
            batch.IsActive = false;
            await _repository.SaveAsync();

            _logger.LogInfo($"POS batch discarded. BatchNumber: {batch.BatchNumber}, Lines: {lines.Count}");
            return Unit.Value;
        }
    }
}
