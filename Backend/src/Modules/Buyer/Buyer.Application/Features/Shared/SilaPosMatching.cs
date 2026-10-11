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
        public const string ROW_OUTLET_MAPPING_MISSING = "OUTLET_MAPPING_MISSING";
        public const string ROW_OUTLET_INACTIVE = "OUTLET_INACTIVE";
        public const string ROW_CONSUMPTION_DISABLED = "CONSUMPTION_DISABLED";
        public const string ROW_INVALID_UOM = "INVALID_UOM";
        public const string ROW_RECIPE_NOT_READY = "RECIPE_NOT_READY";

        private List<InventoryLocation> _outlets = new();
        private Dictionary<Guid, string> _outletCodes = new();
        private Dictionary<Guid, Dictionary<string, Guid>> _outletMappings = new();
        private Dictionary<Guid, Dictionary<string, Guid>> _itemMappings = new();
        private Dictionary<Guid, Recipe> _recipes = new();
        private Dictionary<string, Recipe> _recipesByPosCode = new(StringComparer.OrdinalIgnoreCase);
        private Dictionary<string, Recipe> _recipesByPosItem = new(StringComparer.OrdinalIgnoreCase);
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
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive
                        && (x.LocationType == Common.SILA_LOCATION_OUTLET
                            || x.LocationType == Common.SILA_LOCATION_STORE
                            || x.LocationType == Common.SILA_LOCATION_VENUE))
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
                    x => x.GroupBy(y => Normalize(y.PosOutletCode), StringComparer.OrdinalIgnoreCase)
                        .ToDictionary(y => y.Key, y => y.First().OutletLocationId, StringComparer.OrdinalIgnoreCase));
                List<PosItemMapping> itemMappings = await repository.PosItemMapping
                    .FindByCondition(x => sources.Contains(x.PosSourceId) && x.IsActive)
                    .ToListAsync(cancellationToken);
                context._itemMappings = itemMappings.GroupBy(x => x.PosSourceId).ToDictionary(
                    x => x.Key,
                    x => x.GroupBy(y => Normalize(y.PosItemCode), StringComparer.OrdinalIgnoreCase)
                        .ToDictionary(y => y.Key, y => y.First().RecipeId, StringComparer.OrdinalIgnoreCase));
            }

            List<Recipe> recipes = await repository.Recipe
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .ToListAsync(cancellationToken);
            context._recipes = recipes.ToDictionary(x => x.Id);
            foreach (Recipe recipe in recipes.Where(x => !string.IsNullOrWhiteSpace(x.PosCode)).OrderByDescending(x => x.ActiveVersion))
            {
                context._recipesByPosCode.TryAdd(Normalize(recipe.PosCode), recipe);
            }

            foreach (Recipe recipe in recipes.Where(x => !string.IsNullOrWhiteSpace(x.PosItem)).OrderByDescending(x => x.ActiveVersion))
            {
                context._recipesByPosItem.TryAdd(Normalize(recipe.PosItem), recipe);
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

        /// <summary>Letters and digits only, upper case, so "eh-01" and "EH01" are the same outlet code.</summary>
        public static string Normalize(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            return new string(value.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        }

        /// <summary>Matches a sold line; the first problem found decides the status.</summary>
        public SilaPosMatch Match(Guid? sourceId, string outletCode, string posCode, string? uom)
        {
            SilaPosMatch match = new SilaPosMatch();
            string outletKey = Normalize(outletCode);
            Guid mappedLocationId = Guid.Empty;
            bool mapped = sourceId != null
                && _outletMappings.TryGetValue(sourceId.Value, out Dictionary<string, Guid>? outletMap)
                && outletMap.TryGetValue(outletKey, out mappedLocationId);
            if (mapped)
            {
                match.Outlet = _outlets.FirstOrDefault(x => x.Id == mappedLocationId);
                if (match.Outlet == null)
                {
                    return Problem(match, ROW_OUTLET_INACTIVE, $"POS outlet {outletCode.Trim()} is mapped to a location that is not an active outlet, store, or venue.");
                }
            }
            else if (sourceId != null)
            {
                return Problem(match, ROW_OUTLET_MAPPING_MISSING, $"POS outlet {outletCode.Trim()} has no outlet mapping. Map it to an outlet, store, or venue.");
            }
            else
            {
                match.Outlet = _outlets.FirstOrDefault(x => Normalize(x.LocationCode) == outletKey)
                    ?? _outlets.FirstOrDefault(x => x.OutletId != null
                        && _outletCodes.TryGetValue(x.OutletId.Value, out string? code)
                        && Normalize(code) == outletKey);
                if (match.Outlet == null)
                {
                    return Problem(match, ROW_OUTLET_MAPPING_MISSING, $"POS outlet {outletCode.Trim()} is not an active outlet, store, or venue.");
                }
            }

            if (match.Outlet.ConsumptionEnabled == false)
            {
                return Problem(match, ROW_CONSUMPTION_DISABLED, $"Consumption is disabled at {match.Outlet.LocationCode}.");
            }

            string itemKey = Normalize(posCode);
            match.Recipe = MenuRecipe(match.Outlet.Id, itemKey);
            if (match.Recipe == null
                && sourceId != null
                && _itemMappings.TryGetValue(sourceId.Value, out Dictionary<string, Guid>? itemMap)
                && itemMap.TryGetValue(itemKey, out Guid mappedRecipeId))
            {
                match.Recipe = _recipes.TryGetValue(mappedRecipeId, out Recipe? mappedRecipe) ? mappedRecipe : null;
                if (match.Recipe == null)
                {
                    return Problem(match, ROW_RECIPE_NOT_READY, $"POS item {posCode.Trim()} is mapped to a recipe that is no longer active. Correct the item mapping.");
                }
            }

            if (match.Recipe == null)
            {
                if (!_recipesByPosCode.TryGetValue(itemKey, out Recipe? byCode))
                {
                    _recipesByPosItem.TryGetValue(itemKey, out byCode);
                }

                match.Recipe = byCode;
            }

            if (match.Recipe == null)
            {
                return Problem(match, ROW_UNMAPPED_POS_CODE, $"POS item {posCode.Trim()} is not mapped to a recipe. Add an outlet menu item, an item mapping, or the POS code on the recipe.");
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

        private Recipe? MenuRecipe(Guid outletId, string itemKey)
        {
            if (itemKey.Length == 0)
            {
                return null;
            }

            return _recipes.Values
                .Where(recipe => _pricedOutlets.Contains((recipe.Id, outletId))
                    && (Normalize(recipe.PosCode) == itemKey || Normalize(recipe.PosItem) == itemKey))
                .OrderByDescending(recipe => recipe.ActiveVersion)
                .FirstOrDefault();
        }

        private static SilaPosMatch Problem(SilaPosMatch match, string status, string message)
        {
            match.Status = status;
            match.Message = message;
            return match;
        }
    }
}
