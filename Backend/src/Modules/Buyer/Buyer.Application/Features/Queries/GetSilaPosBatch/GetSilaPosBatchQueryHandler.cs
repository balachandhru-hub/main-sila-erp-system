using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPosBatch
{
    /// <summary>The header of one sales batch; its lines are listed by pos/transactions?batchId=.</summary>
    public class GetSilaPosBatchQueryHandler : IRequestHandler<GetSilaPosBatchQuery, SilaPosBatchDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaPosBatchQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<SilaPosBatchDto> Handle(GetSilaPosBatchQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching POS batch. OrganizationId: {request.OrganizationId}, BatchId: {request.BatchId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSalesBatch? batch = await _repository.PosSalesBatch
                .FindByCondition(x => x.Id == request.BatchId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (batch == null)
            {
                _logger.LogError($"POS batch not found. BatchId: {request.BatchId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Sales batch not found.", "Select a sales batch of this organization.");
            }

            int failed = await _repository.PosSalesTransaction
                .FindByCondition(x => x.BatchId == batch.Id && x.BuyerId == buyer.Id && x.IsActive && x.Status == Common.SILA_POS_FAILED)
                .CountAsync(cancellationToken);
            string? sourceName = batch.PosSourceId == null
                ? null
                : await _repository.PosSource
                    .FindByCondition(x => x.Id == batch.PosSourceId.Value)
                    .Select(x => x.Name)
                    .FirstOrDefaultAsync(cancellationToken);
            string? uploadedByName = "Scheduler";
            if (batch.UploadedBy != Guid.Empty)
            {
                List<IdentityUserDto> users = await _identityApiClient.GetUsersByIds(new List<Guid> { batch.UploadedBy }, cancellationToken);
                uploadedByName = users.FirstOrDefault()?.Name;
            }

            SilaPosBatchDto result = SilaPosSources.ToBatchDto(batch, failed, sourceName, uploadedByName);
            await SilaPosBatchCounts.AddAsync(_repository, buyer.Id, new List<SilaPosBatchDto> { result }, cancellationToken);
            _logger.LogInfo($"POS batch fetched. BatchNumber: {batch.BatchNumber}, Status: {result.Status}");
            return result;
        }
    }
}
