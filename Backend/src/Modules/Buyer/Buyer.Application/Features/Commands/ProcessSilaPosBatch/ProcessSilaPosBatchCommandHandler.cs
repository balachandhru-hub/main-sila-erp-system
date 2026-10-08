using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ProcessSilaPosBatch
{
    /// <summary>
    /// Step 2 of the upload: processes the RECEIVED lines of a PREVIEW batch (match, deduct stock, queue the ERP posting) and marks
    /// the batch PROCESSED. Lines that are not ready fail with their reason and can be reprocessed from the tracker.
    /// </summary>
    public class ProcessSilaPosBatchCommandHandler : IRequestHandler<ProcessSilaPosBatchCommand, SilaPosImportResultDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ProcessSilaPosBatchCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<SilaPosImportResultDto> Handle(ProcessSilaPosBatchCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunForJobAsync(_repository, _logger, nameof(ProcessSilaPosBatchCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<SilaPosImportResultDto> HandleOnceAsync(ProcessSilaPosBatchCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Processing POS batch. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, BatchId: {request.BatchId}");

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
                _logger.LogError($"POS batch is not a preview. BatchId: {batch.Id}, Status: {batch.Status}");
                throw new BadRequestCustomException("This batch is already processed.", "Open the Transaction Tracker to follow its lines or reprocess failed ones.");
            }

            List<PosSalesTransaction> lines = await _repository.PosSalesTransaction
                .FindByCondition(x => x.BatchId == batch.Id && x.BuyerId == buyer.Id && x.IsActive && x.Status == Common.SILA_POS_RECEIVED)
                .OrderBy(x => x.BusinessDate)
                .ThenBy(x => x.SourceTransactionId)
                .ThenBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);
            _repository.PosSalesTransaction.UpdateRange(lines);
            int alreadyPosted = await _repository.PosSalesTransaction
                .FindByCondition(x => x.BatchId == batch.Id && x.BuyerId == buyer.Id && x.IsActive
                    && (x.Status == Common.SILA_POS_INVENTORY_DEDUCTED || x.Status == Common.SILA_POS_POSTED))
                .CountAsync(cancellationToken);

            int failed = await SilaPosProcessing.ProcessAsync(_repository, _logger, buyer.Id, request.UserId, lines, cancellationToken);
            batch.Status = Common.SILA_POS_BATCH_PROCESSED;
            batch.Accepted = lines.Count;
            await _repository.SaveAsync();

            SilaPosImportResultDto result = new SilaPosImportResultDto
            {
                BatchId = batch.Id,
                BatchNumber = batch.BatchNumber,
                Rows = batch.Rows,
                Accepted = lines.Count,
                Duplicates = batch.Duplicates,
                Invalid = batch.Invalid,
                Processed = lines.Count - failed,
                Failed = failed,
                AlreadyPosted = alreadyPosted
            };
            SilaPosBatchDto counts = new SilaPosBatchDto { Id = batch.Id };
            await SilaPosBatchCounts.AddAsync(_repository, buyer.Id, new List<SilaPosBatchDto> { counts }, cancellationToken);
            result.PostingUnknown = counts.PostingUnknown;

            _logger.LogInfo($"POS batch processed. BatchNumber: {batch.BatchNumber}, Lines: {lines.Count}, Failed: {failed}");
            return result;
        }
    }
}
