using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.ExportSilaRecipes
{
    /// <summary>
    /// Sheet "Recipes" with one row per ingredient of each recipe's latest version (the recipe columns repeat on every row)
    /// and sheet "OutletPrices" with one row per outlet menu price. The template has the same sheets with one example row.
    /// Inactive recipes are left out. The file can be edited and imported again.
    /// </summary>
    public class ExportSilaRecipesQueryHandler : IRequestHandler<ExportSilaRecipesQuery, SilaRecipeFileDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ExportSilaRecipesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaRecipeFileDto> Handle(ExportSilaRecipesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Exporting recipes. OrganizationId: {request.OrganizationId}, Template: {request.Template}");

            SilaRecipeExcel.Sheet recipeSheet = new SilaRecipeExcel.Sheet { Name = SilaRecipeImport.SHEET_RECIPES, Headers = SilaRecipeImport.RecipeColumns };
            SilaRecipeExcel.Sheet priceSheet = new SilaRecipeExcel.Sheet { Name = SilaRecipeImport.SHEET_PRICES, Headers = SilaRecipeImport.PriceColumns };
            if (request.Template)
            {
                recipeSheet.Rows.Add(new object?[] { null, "Gin and tonic", "BEVERAGE", "COCKTAIL", "RECIPE", 1m, "EA", "EA", "POS-1001", "AED", null, "MAT-GIN", null, 50m, "ML", null, null });
                recipeSheet.Rows.Add(new object?[] { null, "Gin and tonic", "BEVERAGE", "COCKTAIL", "RECIPE", 1m, "EA", "EA", "POS-1001", "AED", null, "MAT-TONIC", null, 1m, "BTL", null, null });
                priceSheet.Rows.Add(new object?[] { null, "Gin and tonic", "OUTLET-01", 45m, "AED" });
                SilaRecipeFileDto template = SilaRecipeExcel.Build("recipes-template.xlsx", recipeSheet, priceSheet);
                _logger.LogInfo("Recipe template built.");
                return template;
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Recipe> recipes = await _repository.Recipe
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Status != Common.SILA_RECIPE_INACTIVE)
                .OrderBy(x => x.RecipeCode)
                .ToListAsync(cancellationToken);
            SilaRecipeReadiness rows = await SilaRecipeReadiness.LoadAsync(_repository, buyer.Id, recipes.Select(x => x.Id).ToList(), cancellationToken);
            Dictionary<Guid, string> families = await _repository.RecipeFamily
                .FindByCondition(x => x.BuyerId == buyer.Id)
                .ToDictionaryAsync(x => x.Id, x => x.Code, cancellationToken);
            Dictionary<Guid, string> categories = await _repository.RecipeCategory
                .FindByCondition(x => x.BuyerId == buyer.Id)
                .ToDictionaryAsync(x => x.Id, x => x.Code, cancellationToken);
            Dictionary<Guid, string> outlets = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && x.LocationType == Common.SILA_LOCATION_OUTLET)
                .ToDictionaryAsync(x => x.Id, x => x.LocationCode, cancellationToken);
            Dictionary<Guid, string> recipeCodes = recipes.ToDictionary(x => x.Id, x => x.RecipeCode);

            foreach (Recipe recipe in recipes)
            {
                string? family = recipe.FamilyId != null && families.TryGetValue(recipe.FamilyId.Value, out string? familyCode) ? familyCode : null;
                string? category = recipe.CategoryId != null && categories.TryGetValue(recipe.CategoryId.Value, out string? categoryCode) ? categoryCode : null;
                foreach (RecipeIngredient ingredient in rows.IngredientsOf(recipe.Id, recipe.Version))
                {
                    string? subCode = ingredient.SubRecipeId == null
                        ? null
                        : recipeCodes.TryGetValue(ingredient.SubRecipeId.Value, out string? code) ? code : ingredient.ItemCode;
                    recipeSheet.Rows.Add(new object?[]
                    {
                        recipe.RecipeCode, SilaRecipeRules.LatestName(recipe), family, category, recipe.ItemMode, SilaRecipeRules.LatestServingQty(recipe),
                        SilaRecipeRules.LatestServingUom(recipe), SilaRecipeRules.LatestSellingUom(recipe),
                        SilaRecipeRules.LatestPosCode(recipe), recipe.Currency, recipe.Description, ingredient.MaterialId == null ? null : ingredient.ItemCode, subCode,
                        ingredient.Quantity, ingredient.Uom, recipe.Version, SilaRecipeRules.VersionStatus(recipe, recipe.Version)
                    });
                }

                foreach (RecipeOutletPrice price in rows.PricesOf(recipe.Id, recipe.Version))
                {
                    priceSheet.Rows.Add(new object?[]
                    {
                        recipe.RecipeCode, SilaRecipeRules.LatestName(recipe), outlets.TryGetValue(price.OutletLocationId, out string? outlet) ? outlet : null, price.MenuPrice, price.Currency
                    });
                }
            }

            SilaRecipeFileDto file = SilaRecipeExcel.Build($"recipes-{DateTime.UtcNow:yyyyMMdd}.xlsx", recipeSheet, priceSheet);
            _logger.LogInfo($"Recipes exported. Recipes: {recipes.Count}, IngredientRows: {recipeSheet.Rows.Count}, PriceRows: {priceSheet.Rows.Count}");
            return file;
        }
    }
}
