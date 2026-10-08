using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Sub-recipes, outlet locations and list rows of recipes.</summary>
    public static partial class SilaRecipeRules
    {
        /// <summary>List rows of the recipes (latest version) with counts, family names and readiness, in batch queries.</summary>
        public static async Task<List<SilaRecipeListItemDto>> ToListItemsAsync(
            IRepositoryWrapper repository, Guid buyerId, List<Recipe> recipes, CancellationToken cancellationToken)
        {
            SilaRecipeReadiness readiness = await SilaRecipeReadiness.LoadAsync(repository, buyerId, recipes.Select(x => x.Id).ToList(), cancellationToken);
            List<Guid> familyIds = recipes.Where(x => x.FamilyId != null).Select(x => x.FamilyId!.Value).Distinct().ToList();
            Dictionary<Guid, string> families = familyIds.Count == 0
                ? new Dictionary<Guid, string>()
                : await repository.RecipeFamily
                    .FindByCondition(x => familyIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

            return recipes.Select(recipe =>
            {
                SilaRecipeReadinessDto check = readiness.Evaluate(recipe, recipe.Version);
                return new SilaRecipeListItemDto
                {
                    Id = recipe.Id,
                    RecipeCode = recipe.RecipeCode,
                    Name = recipe.Name,
                    Category = recipe.Category,
                    FamilyId = recipe.FamilyId,
                    FamilyName = recipe.FamilyId != null && families.TryGetValue(recipe.FamilyId.Value, out string? family) ? family : null,
                    CategoryId = recipe.CategoryId,
                    ItemMode = recipe.ItemMode,
                    ServingQty = recipe.ServingQty,
                    ServingUom = recipe.ServingUom,
                    SellingUom = recipe.SellingUom,
                    PosCode = recipe.PosCode,
                    HasDraftHeader = HasDraftHeader(recipe),
                    DraftName = recipe.DraftName,
                    DraftPosCode = recipe.DraftPosCode,
                    DraftServingQty = recipe.DraftServingQty,
                    DraftServingUom = recipe.DraftServingUom,
                    DraftSellingUom = recipe.DraftSellingUom,
                    Status = recipe.Status,
                    Version = recipe.Version,
                    ActiveVersion = recipe.ActiveVersion,
                    Ready = check.Ready,
                    IssueCount = check.Issues.Count,
                    CostComplete = check.CostComplete,
                    ReadinessStatus = check.Status,
                    TotalCost = recipe.TotalCost,
                    DraftTotalCost = recipe.DraftTotalCost,
                    CostPerServing = CostPerServing(recipe.TotalCost, recipe.ServingQty),
                    PosItem = recipe.PosItem,
                    LastSaleDate = recipe.LastSaleDate,
                    Currency = recipe.Currency,
                    IngredientCount = readiness.IngredientsOf(recipe.Id, recipe.Version).Count,
                    OutletCount = readiness.PricesOf(recipe.Id, recipe.Version).Count,
                    SubmittedOn = recipe.SubmittedOn,
                    ApprovedOn = recipe.ApprovedOn,
                    DateUpdated = recipe.DateUpdated
                };
            }).ToList();
        }

        /// <summary>The scope of a recipe's approval: its first outlet (by code) of the version, that outlet's property and company code.</summary>
        public static async Task<ApprovalScope> GetApprovalScopeAsync(IRepositoryWrapper repository, Recipe recipe, CancellationToken cancellationToken)
        {
            List<Guid> outletIds = await repository.RecipeOutletPrice
                .FindByCondition(x => x.RecipeId == recipe.Id && x.Version == recipe.Version && x.IsActive)
                .Select(x => x.OutletLocationId)
                .ToListAsync(cancellationToken);
            InventoryLocation? outlet = outletIds.Count == 0
                ? null
                : await repository.InventoryLocation
                    .FindByCondition(x => outletIds.Contains(x.Id))
                    .OrderBy(x => x.LocationCode)
                    .FirstOrDefaultAsync(cancellationToken);
            if (outlet == null)
            {
                return new ApprovalScope();
            }

            string? companyCode = await repository.BuyerProperty
                .FindByCondition(x => x.Id == outlet.PropertyId)
                .Select(x => x.CompanyCode)
                .FirstOrDefaultAsync(cancellationToken);
            return new ApprovalScope { LocationId = outlet.Id, PropertyId = outlet.PropertyId, CompanyCode = companyCode };
        }

        /// <summary>Sub-recipes of a batch with their cost per serving of the approved (active) version.</summary>
        private static async Task<Dictionary<Guid, (Recipe Recipe, decimal CostPerServing)>> GetSubRecipesAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            Guid recipeId,
            List<SilaRecipeIngredientWriteDto> lines,
            CancellationToken cancellationToken)
        {
            List<Guid> ids = lines.Where(x => x.SubRecipeId != null).Select(x => x.SubRecipeId!.Value).Distinct().ToList();
            if (ids.Count == 0)
            {
                return new Dictionary<Guid, (Recipe Recipe, decimal CostPerServing)>();
            }

            if (ids.Contains(recipeId))
            {
                logger.LogError($"Recipe contains itself. RecipeId: {recipeId}");
                throw new BadRequestCustomException("A recipe cannot contain itself.", "Remove the recipe from its own ingredients.");
            }

            Dictionary<Guid, Recipe> subRecipes = await repository.Recipe
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && ids.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Recipe? notApproved = subRecipes.Values.FirstOrDefault(x => x.ActiveVersion <= 0 || x.Status == Common.SILA_RECIPE_INACTIVE);
            if (subRecipes.Count != ids.Count || notApproved != null)
            {
                logger.LogError($"Sub-recipe missing or not approved. RecipeId: {recipeId}, SubRecipe: {notApproved?.RecipeCode}");
                throw new BadRequestCustomException(
                    "Sub-recipe is not approved.",
                    notApproved == null ? "Select approved recipes of this organization." : $"{notApproved.RecipeCode} {notApproved.Name} must be approved before it is used in a batch.");
            }

            // A sub-recipe that (through its own batches, any version) contains this recipe would make a cycle.
            List<RecipeIngredient> nested = await repository.RecipeIngredient
                .FindByCondition(x => x.IsActive && x.SubRecipeId != null && x.Recipe.BuyerId == buyerId)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, List<Guid>> children = nested.GroupBy(x => x.RecipeId)
                .ToDictionary(x => x.Key, x => x.Select(y => y.SubRecipeId!.Value).ToList());
            foreach (Guid id in ids)
            {
                if (Reaches(children, id, recipeId, new HashSet<Guid>()))
                {
                    Recipe sub = subRecipes[id];
                    logger.LogError($"Sub-recipe cycle. RecipeId: {recipeId}, SubRecipeId: {id}");
                    throw new BadRequestCustomException("Recipes would contain each other.", $"{sub.RecipeCode} {sub.Name} already contains this recipe.");
                }
            }

            List<RecipeIngredient> subRows = await repository.RecipeIngredient
                .FindByCondition(x => ids.Contains(x.RecipeId) && x.IsActive && x.Version == x.Recipe.ActiveVersion)
                .ToListAsync(cancellationToken);
            return subRecipes.Values.ToDictionary(
                x => x.Id,
                x =>
                {
                    decimal cost = subRows.Where(row => row.RecipeId == x.Id).Sum(row => row.Cost);
                    return (x, x.ServingQty > 0 ? Math.Round(cost / x.ServingQty, 4) : 0m);
                });
        }

        private static bool Reaches(Dictionary<Guid, List<Guid>> children, Guid from, Guid target, HashSet<Guid> seen)
        {
            if (from == target)
            {
                return true;
            }

            if (!seen.Add(from) || !children.TryGetValue(from, out List<Guid>? next))
            {
                return false;
            }

            return next.Any(child => Reaches(children, child, target, seen));
        }

        /// <summary>
        /// The priced outlet locations. An outlet the recipe was not priced for before needs the user's access to that
        /// location (the buyer administrator, store manager and cost controller see every location).
        /// </summary>
        private static async Task<Dictionary<Guid, InventoryLocation>> GetOutletLocationsAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            Guid userId,
            Guid roleId,
            Guid recipeId,
            List<SilaRecipeOutletPriceWriteDto> prices,
            CancellationToken cancellationToken)
        {
            if (prices.GroupBy(x => x.OutletLocationId).Any(x => x.Count() > 1))
            {
                logger.LogError($"Outlet priced twice. BuyerId: {buyerId}");
                throw new BadRequestCustomException("Outlet is repeated.", "Enter one menu price per outlet.");
            }

            if (prices.Any(x => x.MenuPrice <= 0 || x.MenuPrice > 1000000000m))
            {
                logger.LogError($"Menu price out of range. BuyerId: {buyerId}");
                throw new BadRequestCustomException("Menu price is invalid.", "Enter a menu price greater than zero for every outlet.");
            }

            List<Guid> ids = prices.Select(x => x.OutletLocationId).ToList();
            Dictionary<Guid, InventoryLocation> outlets = ids.Count == 0
                ? new Dictionary<Guid, InventoryLocation>()
                : await repository.InventoryLocation
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.LocationType == Common.SILA_LOCATION_OUTLET && ids.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);
            if (outlets.Count != ids.Count)
            {
                logger.LogError($"Outlet location not found. BuyerId: {buyerId}, Requested: {ids.Count}, Found: {outlets.Count}");
                throw new NotFoundCustomException("Outlet not found.", "Price the recipe for active outlet locations of this organization.");
            }

            if (ids.Count > 0 && !SilaAccess.HasFullAccess(roleId))
            {
                List<Guid> pricedBefore = await repository.RecipeOutletPrice
                    .FindByCondition(x => x.RecipeId == recipeId && x.IsActive)
                    .Select(x => x.OutletLocationId)
                    .Distinct()
                    .ToListAsync(cancellationToken);
                List<Guid> added = ids.Where(x => !pricedBefore.Contains(x)).ToList();
                if (added.Count > 0)
                {
                    List<Guid> allowed = await SilaAccess.GetLocationIdsAsync(repository, buyerId, userId, roleId, cancellationToken);
                    Guid denied = added.FirstOrDefault(x => !allowed.Contains(x));
                    if (denied != Guid.Empty)
                    {
                        logger.LogError($"User may not price the outlet. UserId: {userId}, LocationId: {denied}");
                        throw new ForBiddenCustomException(
                            "No access to this outlet.",
                            $"You are not assigned to outlet {outlets[denied].LocationCode}. Ask your administrator, or remove its price.");
                    }
                }
            }

            return outlets;
        }
    }
}
