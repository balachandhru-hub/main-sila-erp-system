using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPosSources
{
    public class GetSilaPosSourcesQueryHandler : IRequestHandler<GetSilaPosSourcesQuery, List<SilaPosSourceDto>>
    {
        private const int MAX_SOURCES = 200;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaPosSourcesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaPosSourceDto>> Handle(GetSilaPosSourcesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching POS sources. OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<PosSource> sources = await _repository.PosSource
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive)
                .OrderByDescending(x => x.IsDefault)
                .ThenBy(x => x.Name)
                .Take(MAX_SOURCES)
                .ToListAsync(cancellationToken);
            List<Guid> sourceIds = sources.Select(x => x.Id).ToList();
            Dictionary<Guid, int> outletCounts = await _repository.PosOutletMapping
                .FindByCondition(x => sourceIds.Contains(x.PosSourceId) && x.IsActive)
                .GroupBy(x => x.PosSourceId)
                .Select(x => new { SourceId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.SourceId, x => x.Count, cancellationToken);
            Dictionary<Guid, int> itemCounts = await _repository.PosItemMapping
                .FindByCondition(x => sourceIds.Contains(x.PosSourceId) && x.IsActive)
                .GroupBy(x => x.PosSourceId)
                .Select(x => new { SourceId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.SourceId, x => x.Count, cancellationToken);

            List<SilaPosSourceDto> result = sources.Select(x => new SilaPosSourceDto
            {
                Id = x.Id,
                Name = x.Name,
                PosSystem = x.PosSystem,
                IntegrationKind = x.IntegrationKind,
                IsDefault = x.IsDefault,
                OutletMappingCount = outletCounts.GetValueOrDefault(x.Id),
                ItemMappingCount = itemCounts.GetValueOrDefault(x.Id)
            }).ToList();

            _logger.LogInfo($"POS sources fetched. Count: {result.Count}");
            return result;
        }
    }
}
