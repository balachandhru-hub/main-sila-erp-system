using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPosBatches
{
    /// <summary>POS sales batches, newest first, with the number of their lines that are failed now.</summary>
    public class GetSilaPosBatchesQueryHandler : IRequestHandler<GetSilaPosBatchesQuery, List<SilaPosBatchDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaPosBatchesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaPosBatchDto>> Handle(GetSilaPosBatchesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching POS batches. OrganizationId: {request.OrganizationId}, Index: {request.Index}, Limit: {request.Limit}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            int limit = request.Limit <= 0 ? 20 : Math.Min(request.Limit, 200);
            List<PosSalesBatch> batches = await _repository.PosSalesBatch
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive)
                .OrderByDescending(x => x.DateCreated)
                .Skip(Math.Max(0, request.Index))
                .Take(limit)
                .ToListAsync(cancellationToken);
            List<Guid?> batchIds = batches.Select(x => (Guid?)x.Id).ToList();
            Dictionary<Guid, int> failed = await _repository.PosSalesTransaction
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Status == Common.SILA_POS_FAILED && batchIds.Contains(x.BatchId))
                .GroupBy(x => x.BatchId!.Value)
                .Select(x => new { BatchId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.BatchId, x => x.Count, cancellationToken);

            List<Guid> userIds = batches.Select(x => x.UploadedBy).Where(x => x != Guid.Empty).Distinct().ToList();
            List<IdentityUserDto> users = userIds.Count == 0
                ? new List<IdentityUserDto>()
                : await _identityApiClient.GetUsersByIds(userIds, cancellationToken);

            List<Guid> sourceIds = batches.Where(x => x.PosSourceId != null).Select(x => x.PosSourceId!.Value).Distinct().ToList();
            Dictionary<Guid, string> sourceNames = sourceIds.Count == 0
                ? new Dictionary<Guid, string>()
                : await _repository.PosSource
                    .FindByCondition(x => sourceIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

            List<SilaPosBatchDto> result = batches.Select(x => SilaPosSources.ToBatchDto(
                x,
                failed.GetValueOrDefault(x.Id),
                x.PosSourceId != null && sourceNames.TryGetValue(x.PosSourceId.Value, out string? sourceName) ? sourceName : null,
                x.UploadedBy == Guid.Empty ? "Scheduler" : users.FirstOrDefault(u => u.UserId == x.UploadedBy)?.Name)).ToList();
            await SilaPosBatchCounts.AddAsync(_repository, buyer.Id, result, cancellationToken);

            _logger.LogInfo($"POS batches fetched. Count: {result.Count}");
            return result;
        }
    }
}
