using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPosItemMappings
{
    /// <summary>Item mappings of a POS source with the mapped recipe and its approved version.</summary>
    public class GetSilaPosItemMappingsQueryHandler : IRequestHandler<GetSilaPosItemMappingsQuery, SilaPosPageDto<SilaPosItemMappingDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaPosItemMappingsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaPosPageDto<SilaPosItemMappingDto>> Handle(GetSilaPosItemMappingsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching POS item mappings. OrganizationId: {request.OrganizationId}, SourceId: {request.SourceId}, Search: {request.Search}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSource source = await SilaPosSources.GetSourceAsync(_repository, _logger, buyer.Id, request.SourceId);
            Guid buyerId = buyer.Id;
            IQueryable<PosItemMapping> query = _repository.PosItemMapping.FindByCondition(x => x.PosSourceId == source.Id && x.IsActive);
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                IQueryable<Guid> recipeIds = _repository.Recipe
                    .FindByCondition(x => x.BuyerId == buyerId && (x.RecipeCode.Contains(search) || x.Name.Contains(search)))
                    .Select(x => x.Id);
                query = query.Where(x => x.PosItemCode.Contains(search)
                    || (x.PosItemDescription != null && x.PosItemDescription.Contains(search))
                    || recipeIds.Contains(x.RecipeId));
            }

            int limit = SilaPosSources.Limit(request.Limit);
            int index = Math.Max(0, request.Index);
            int total = await query.CountAsync(cancellationToken);
            List<PosItemMapping> page = await query
                .OrderBy(x => x.PosItemCode)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);
            List<Guid> ids = page.Select(x => x.RecipeId).Distinct().ToList();
            Dictionary<Guid, Recipe> recipes = await _repository.Recipe
                .FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);

            SilaPosPageDto<SilaPosItemMappingDto> result = new SilaPosPageDto<SilaPosItemMappingDto>
            {
                Items = page.Select(x => SilaPosSources.ToDto(x, recipes)).ToList(),
                Total = total,
                Index = index,
                Limit = limit
            };

            _logger.LogInfo($"POS item mappings fetched. Total: {total}, Page: {result.Items.Count}");
            return result;
        }
    }
}
