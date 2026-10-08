using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPosOutletMenuItems
{
    /// <summary>
    /// The menu of a POS outlet: active recipes whose selling (active) version has a menu price at the location of the outlet
    /// mapping, by recipe code, with cost per serving, cost % and margin %, and the POS item of the source mapped to each.
    /// A user without full access needs access to the location.
    /// </summary>
    public class GetSilaPosOutletMenuItemsQueryHandler : IRequestHandler<GetSilaPosOutletMenuItemsQuery, SilaPosPageDto<SilaPosOutletMenuItemDto>>
    {
        private const int MAX_SEARCH = 100;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaPosOutletMenuItemsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaPosPageDto<SilaPosOutletMenuItemDto>> Handle(GetSilaPosOutletMenuItemsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching POS outlet menu items. SourceId: {request.SourceId}, OutletMappingId: {request.OutletMappingId}, Index: {request.Index}, Limit: {request.Limit}");

            SilaInputRules.MaxLength(_logger, request.Search, MAX_SEARCH, "search");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSource source = await SilaPosSources.GetSourceAsync(_repository, _logger, buyer.Id, request.SourceId);
            PosOutletMapping? outlet = await _repository.PosOutletMapping
                .FindByCondition(x => x.Id == request.OutletMappingId && x.PosSourceId == source.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (outlet == null)
            {
                _logger.LogError($"POS outlet mapping not found. OutletMappingId: {request.OutletMappingId}, SourceId: {source.Id}");
                throw new NotFoundCustomException("Outlet mapping not found.", "Select an outlet mapping of this POS source.");
            }

            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, outlet.OutletLocationId, cancellationToken);

            IQueryable<Recipe> recipes = _repository.Recipe.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive
                && x.ActiveVersion > 0 && x.Status != Common.SILA_RECIPE_INACTIVE);
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                recipes = recipes.Where(x => x.RecipeCode.Contains(search) || x.Name.Contains(search)
                    || (x.PosCode != null && x.PosCode.Contains(search)) || (x.PosItem != null && x.PosItem.Contains(search)));
            }

            IQueryable<RecipeOutletPrice> prices = _repository.RecipeOutletPrice
                .FindByCondition(x => x.IsActive && x.OutletLocationId == outlet.OutletLocationId);
            var priced = recipes.Join(
                prices,
                r => new { RecipeId = r.Id, Version = r.ActiveVersion },
                p => new { p.RecipeId, p.Version },
                (r, p) => new { Recipe = r, Price = p });

            int total = await priced.CountAsync(cancellationToken);
            int limit = SilaInputRules.Limit(request.Limit);
            int index = SilaInputRules.Index(request.Index);
            var page = await priced
                .OrderBy(x => x.Recipe.RecipeCode)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);

            List<Guid> recipeIds = page.Select(x => x.Recipe.Id).ToList();
            List<PosItemMapping> mappings = recipeIds.Count == 0
                ? new List<PosItemMapping>()
                : await _repository.PosItemMapping
                    .FindByCondition(x => x.PosSourceId == source.Id && x.IsActive && recipeIds.Contains(x.RecipeId))
                    .ToListAsync(cancellationToken);

            List<SilaPosOutletMenuItemDto> items = page.Select(x =>
            {
                decimal perServing = SilaRecipeRules.CostPerServing(x.Recipe.TotalCost, x.Recipe.ServingQty);
                PosItemMapping? mapping = mappings.Where(m => m.RecipeId == x.Recipe.Id).OrderBy(m => m.PosItemCode).FirstOrDefault();
                return new SilaPosOutletMenuItemDto
                {
                    RecipeId = x.Recipe.Id,
                    RecipeCode = x.Recipe.RecipeCode,
                    Name = x.Recipe.Name,
                    PosCode = x.Recipe.PosCode,
                    PosItem = x.Recipe.PosItem,
                    ActiveVersion = x.Recipe.ActiveVersion,
                    MenuPrice = x.Price.MenuPrice,
                    Currency = x.Price.Currency ?? x.Recipe.Currency,
                    CostPerServing = perServing,
                    CostPercent = SilaRecipeRules.CostPercent(perServing, x.Price.MenuPrice),
                    MarginPercent = SilaRecipeRules.MarginPercent(perServing, x.Price.MenuPrice),
                    PosItemMappingId = mapping?.Id,
                    PosItemCode = mapping?.PosItemCode,
                    PosItemDescription = mapping?.PosItemDescription,
                    LastSaleDate = x.Recipe.LastSaleDate
                };
            }).ToList();

            _logger.LogInfo($"POS outlet menu items fetched. OutletMappingId: {outlet.Id}, Count: {items.Count}, Total: {total}");
            return new SilaPosPageDto<SilaPosOutletMenuItemDto> { Items = items, Total = total, Index = index, Limit = limit };
        }
    }
}
