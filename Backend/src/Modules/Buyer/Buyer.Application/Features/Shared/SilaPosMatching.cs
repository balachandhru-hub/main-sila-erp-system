using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Outcome of matching one sold line to an outlet location and a sellable recipe.</summary>
    public class SilaPosMatch
    {
        /// <summary>READY | UNMAPPED_POS_CODE | INVALID_OUTLET | INVALID_UOM | RECIPE_NOT_READY</summary>
        public string Status { get; set; } = SilaPosMatching.ROW_READY;
        public string? Message { get; set; }
        public InventoryLocation? Outlet { get; set; }
        public Recipe? Recipe { get; set; }
    }

    /// <summary>
    /// The matching rules of a POS sale, used by the upload preview and by processing:
    /// outlet = PosOutletMapping of the batch's source, else an outlet location with that location code, else the outlet code of
    /// its BuyerOutlet; recipe = PosItemMapping of the source, else the recipe with that POS code. The recipe must have an approved
    /// version (ActiveVersion &gt; 0, not INACTIVE), be priced for the outlet in that version, and the sold UOM (when given) must be
    /// the recipe's selling UOM. Ingredients and prices are always read for Version == ActiveVersion.
    /// </summary>
    public class SilaPosMatching
    {
        public const string ROW_READY = "READY";
        public const string ROW_INVALID = "INVALID";
        public const string ROW_DUPLICATE = "DUPLICATE";
        public const string ROW_UNMAPPED_POS_CODE = "UNMAPPED_POS_CODE";
        public const string ROW_INVALID_OUTLET = "INVALID_OUTLET";
        public const string ROW_INVALID_UOM = "INVALID_UOM";
        public const string ROW_RECIPE_NOT_READY = "RECIPE_NOT_READY";

        private List<InventoryLocation> _outlets = new();
        private Dictionary<Guid, string> _outletCodes = new();
        private Dictionary<Guid, Dictionary<string, Guid>> _outletMappings = new();
        private Dictionary<Guid, Dictionary<string, Guid>> _itemMappings = new();
        private Dictionary<Guid, Recipe> _recipes = new();
        private Dictionary<string, Recipe> _recipesByPosCode = new(StringComparer.OrdinalIgnoreCase);
        private HashSet<(Guid RecipeId, Guid OutletLocationId)> _pricedOutlets = new();

        /// <summary>Ingredients of the approved version of each sellable recipe, by recipe id.</summary>
        public Dictionary<Guid, List<RecipeIngredient>> Ingredients { get; private set; } = new();

        public Dictionary<Guid, ItemBuyerMaster> Materials { get; private set; } = new();

        /// <summary>Loads the buyer's outlets, recipes (approved versions) and the mappings of the given sources, in a fixed number of queries.</summary>
        public static async Task<SilaPosMatching> LoadAsync(
            IRepositoryWrapper repository, Guid buyerId, IReadOnlyCollection<Guid> sourceIds, CancellationToken cancellationToken)
        {
            SilaPosMatching context = new SilaPosMatching
            {
                _outlets = await repository.InventoryLocation
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.LocationType == Common.SILA_LOCATION_OUTLET)
                    .ToListAsync(cancellationToken),
                _outletCodes = await repository.BuyerOutlet
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.OutletCode != null)
                    .ToDictionaryAsync(x => x.Id, x => x.OutletCode!, cancellationToken)
            };

            List<Guid> sources = sourceIds.Distinct().ToList();
            if (sources.Count > 0)
            {
                List<PosOutletMapping> outletMappings = await repository.PosOutletMapping
                    .FindByCondition(x => sources.Contains(x.PosSourceId) && x.IsActive)
                    .ToListAsync(cancellationToken);
                context._outletMappings = outletMappings.GroupBy(x => x.PosSourceId).ToDictionary(
                    x => x.Key,
                    x => x.GroupBy(y => y.PosOutletCode.Trim(), StringComparer.OrdinalIgnoreCase)
                        .ToDictionary(y => y.Key, y => y.First().OutletLocationId, StringComparer.OrdinalIgnoreCase));
                List<PosItemMapping> itemMappings = await repository.PosItemMapping
                    .FindByCondition(x => sources.Contains(x.PosSourceId) && x.IsActive)
                    .ToListAsync(cancellationToken);
                context._itemMappings = itemMappings.GroupBy(x => x.PosSourceId).ToDictionary(
                    x => x.Key,
                    x => x.GroupBy(y => y.PosItemCode.Trim(), StringComparer.OrdinalIgnoreCase)
                        .ToDictionary(y => y.Key, y => y.First().RecipeId, StringComparer.OrdinalIgnoreCase));
            }

            List<Recipe> recipes = await repository.Recipe
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .ToListAsync(cancellationToken);
            context._recipes = recipes.ToDictionary(x => x.Id);
            foreach (Recipe recipe in recipes.Where(x => !string.IsNullOrWhiteSpace(x.PosCode)).OrderByDescending(x => x.ActiveVersion))
            {
                context._recipesByPosCode.TryAdd(recipe.PosCode!.Trim(), recipe);
            }

            Dictionary<Guid, int> activeVersions = recipes.Where(IsSellable).ToDictionary(x => x.Id, x => x.ActiveVersion);
            List<Guid> sellableIds = activeVersions.Keys.ToList();
            List<RecipeIngredient> ingredients = sellableIds.Count == 0
                ? new List<RecipeIngredient>()
                : (await repository.RecipeIngredient
                    .FindByCondition(x => sellableIds.Contains(x.RecipeId) && x.IsActive)
                    .ToListAsync(cancellationToken))
                    .Where(x => x.Version == activeVersions[x.RecipeId])
                    .ToList();
            context.Ingredients = ingredients.GroupBy(x => x.RecipeId).ToDictionary(x => x.Key, x => x.OrderBy(y => y.Sequence).ToList());

            List<RecipeOutletPrice> prices = sellableIds.Count == 0
                ? new List<RecipeOutletPrice>()
                : (await repository.RecipeOutletPrice
                    .FindByCondition(x => sellableIds.Contains(x.RecipeId) && x.IsActive)
                    .ToListAsync(cancellationToken))
                    .Where(x => x.Version == activeVersions[x.RecipeId])
                    .ToList();
            context._pricedOutlets = prices.Select(x => (x.RecipeId, x.OutletLocationId)).ToHashSet();

            List<Guid> materialIds = ingredients.Where(x => x.MaterialId != null).Select(x => x.MaterialId!.Value).Distinct().ToList();
            context.Materials = materialIds.Count == 0
                ? new Dictionary<Guid, ItemBuyerMaster>()
                : await repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyerId && materialIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);
            return context;
        }

        /// <summary>A recipe whose approved version may be sold and consumed.</summary>
        public static bool IsSellable(Recipe recipe)
        {
            return recipe.IsActive && recipe.ActiveVersion > 0 && recipe.Status != Common.SILA_RECIPE_INACTIVE;
        }

        public Recipe? SellableRecipe(Guid recipeId)
        {
            return _recipes.TryGetValue(recipeId, out Recipe? recipe) && IsSellable(recipe) ? recipe : null;
        }

        /// <summary>Matches a sold line; the first problem found decides the status.</summary>
        public SilaPosMatch Match(Guid? sourceId, string outletCode, string posCode, string? uom)
        {
            SilaPosMatch match = new SilaPosMatch();
            string outletKey = outletCode.Trim();
            if (sourceId != null
                && _outletMappings.TryGetValue(sourceId.Value, out Dictionary<string, Guid>? outletMap)
                && outletMap.TryGetValue(outletKey, out Guid mappedLocationId))
            {
                match.Outlet = _outlets.FirstOrDefault(x => x.Id == mappedLocationId);
                if (match.Outlet == null)
                {
                    return Problem(match, ROW_INVALID_OUTLET, $"POS outlet {outletKey} is mapped to a location that is no longer an active outlet. Correct the outlet mapping.");
                }
            }
            else
            {
                match.Outlet = _outlets.FirstOrDefault(x => string.Equals(x.LocationCode, outletKey, StringComparison.OrdinalIgnoreCase))
                    ?? _outlets.FirstOrDefault(x => x.OutletId != null
                        && _outletCodes.TryGetValue(x.OutletId.Value, out string? code)
                        && string.Equals(code, outletKey, StringComparison.OrdinalIgnoreCase));
                if (match.Outlet == null)
                {
                    return Problem(match, ROW_INVALID_OUTLET, $"POS outlet {outletKey} is not mapped and no outlet location has that code. Add an outlet mapping.");
                }
            }

            string itemKey = posCode.Trim();
            if (sourceId != null
                && _itemMappings.TryGetValue(sourceId.Value, out Dictionary<string, Guid>? itemMap)
                && itemMap.TryGetValue(itemKey, out Guid mappedRecipeId))
            {
                match.Recipe = _recipes.TryGetValue(mappedRecipeId, out Recipe? mapped) ? mapped : null;
                if (match.Recipe == null)
                {
                    return Problem(match, ROW_RECIPE_NOT_READY, $"POS item {itemKey} is mapped to a recipe that is no longer active. Correct the item mapping.");
                }
            }
            else
            {
                match.Recipe = _recipesByPosCode.TryGetValue(itemKey, out Recipe? byCode) ? byCode : null;
                if (match.Recipe == null)
                {
                    return Problem(match, ROW_UNMAPPED_POS_CODE, $"POS item {itemKey} is not mapped to a recipe. Add an item mapping or set the POS code on the recipe.");
                }
            }

            Recipe recipe = match.Recipe;
            if (!string.IsNullOrWhiteSpace(uom) && !string.Equals(uom.Trim(), recipe.SellingUom.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return Problem(match, ROW_INVALID_UOM, $"Sold in {uom.Trim()} but recipe {recipe.RecipeCode} is sold in {recipe.SellingUom}. Correct the UOM.");
            }

            if (!IsSellable(recipe))
            {
                return Problem(match, ROW_RECIPE_NOT_READY, $"Recipe {recipe.RecipeCode} has no approved version. Get the recipe approved, then process again.");
            }

            if (!_pricedOutlets.Contains((recipe.Id, match.Outlet.Id)))
            {
                return Problem(match, ROW_RECIPE_NOT_READY, $"Recipe {recipe.RecipeCode} has no menu price for outlet {match.Outlet.LocationCode} in its approved version. Add the outlet price and approve the recipe.");
            }

            return match;
        }

        private static SilaPosMatch Problem(SilaPosMatch match, string status, string message)
        {
            match.Status = status;
            match.Message = message;
            return match;
        }
    }
}
