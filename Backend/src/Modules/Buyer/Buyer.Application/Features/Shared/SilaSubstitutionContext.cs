using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// What the substitution engine needs for a set of approved recipes of one buyer, loaded in a fixed number of queries:
    /// the rows of each recipe's active version, its priced outlets and their properties, the stock of every active store
    /// and outlet of those properties (never across properties: moving alcohol between properties is not allowed), the
    /// current month's minimum stock at the outlets, and the in-stock materials of the ingredients' material groups.
    /// </summary>
    public partial class SilaSubstitutionContext
    {
        private readonly Dictionary<Guid, Recipe> _recipes;
        private readonly Dictionary<Guid, List<RecipeIngredient>> _ingredients;
        private readonly Dictionary<Guid, List<RecipeOutletPrice>> _prices;
        private readonly Dictionary<Guid, InventoryLocation> _locations;
        private readonly Dictionary<(Guid PropertyId, Guid MaterialId), decimal> _available;
        private readonly Dictionary<(Guid PropertyId, Guid MaterialId), decimal> _outletMinimum;
        private readonly Dictionary<Guid, ItemBuyerMaster> _materials;
        private readonly List<ItemBuyerMaster> _inStockMaterials;
        private readonly Dictionary<Guid, List<MaterialUomConversion>> _conversions;

        private SilaSubstitutionContext(
            Dictionary<Guid, Recipe> recipes,
            Dictionary<Guid, List<RecipeIngredient>> ingredients,
            Dictionary<Guid, List<RecipeOutletPrice>> prices,
            Dictionary<Guid, InventoryLocation> locations,
            Dictionary<(Guid PropertyId, Guid MaterialId), decimal> available,
            Dictionary<(Guid PropertyId, Guid MaterialId), decimal> outletMinimum,
            Dictionary<Guid, ItemBuyerMaster> materials,
            List<ItemBuyerMaster> inStockMaterials,
            Dictionary<Guid, List<MaterialUomConversion>> conversions)
        {
            _recipes = recipes;
            _ingredients = ingredients;
            _prices = prices;
            _locations = locations;
            _available = available;
            _outletMinimum = outletMinimum;
            _materials = materials;
            _inStockMaterials = inStockMaterials;
            _conversions = conversions;
        }

        public static async Task<SilaSubstitutionContext> LoadAsync(
            IRepositoryWrapper repository, Guid buyerId, List<Recipe> recipes, CancellationToken cancellationToken)
        {
            Dictionary<Guid, Recipe> byId = recipes.GroupBy(x => x.Id).ToDictionary(x => x.Key, x => x.First());
            List<Guid> recipeIds = byId.Keys.ToList();

            // Rows of every version are loaded; only the active version's rows are kept.
            List<RecipeIngredient> ingredientRows = recipeIds.Count == 0
                ? new List<RecipeIngredient>()
                : await repository.RecipeIngredient.FindByCondition(x => recipeIds.Contains(x.RecipeId) && x.IsActive).ToListAsync(cancellationToken);
            List<RecipeOutletPrice> priceRows = recipeIds.Count == 0
                ? new List<RecipeOutletPrice>()
                : await repository.RecipeOutletPrice.FindByCondition(x => recipeIds.Contains(x.RecipeId) && x.IsActive).ToListAsync(cancellationToken);
            Dictionary<Guid, List<RecipeIngredient>> ingredients = ingredientRows
                .Where(x => x.Version == byId[x.RecipeId].ActiveVersion)
                .GroupBy(x => x.RecipeId)
                .ToDictionary(x => x.Key, x => x.OrderBy(y => y.Sequence).ToList());
            Dictionary<Guid, List<RecipeOutletPrice>> prices = priceRows
                .Where(x => x.Version == byId[x.RecipeId].ActiveVersion)
                .GroupBy(x => x.RecipeId)
                .ToDictionary(x => x.Key, x => x.ToList());

            List<Guid> outletIds = prices.Values.SelectMany(x => x).Select(x => x.OutletLocationId).Distinct().ToList();
            List<Guid> propertyIds = outletIds.Count == 0
                ? new List<Guid>()
                : await repository.InventoryLocation
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && outletIds.Contains(x.Id))
                    .Select(x => x.PropertyId)
                    .Distinct()
                    .ToListAsync(cancellationToken);
            Dictionary<Guid, InventoryLocation> locations = propertyIds.Count == 0
                ? new Dictionary<Guid, InventoryLocation>()
                : await repository.InventoryLocation
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && propertyIds.Contains(x.PropertyId)
                        && (x.LocationType == Common.SILA_LOCATION_STORE || x.LocationType == Common.SILA_LOCATION_OUTLET))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);

            List<Guid> ingredientMaterialIds = ingredients.Values.SelectMany(x => x)
                .Where(x => x.MaterialId != null).Select(x => x.MaterialId!.Value).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = ingredientMaterialIds.Count == 0
                ? new Dictionary<Guid, ItemBuyerMaster>()
                : await repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && ingredientMaterialIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);

            // Balances of the ingredients, and every positive balance (the possible substitutes), of the properties' locations.
            List<Guid> locationIds = locations.Keys.ToList();
            List<InventoryBalance> balances = locationIds.Count == 0
                ? new List<InventoryBalance>()
                : await repository.InventoryBalance
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && locationIds.Contains(x.LocationId)
                        && (x.OnHandQty > 0 || ingredientMaterialIds.Contains(x.MaterialId)))
                    .ToListAsync(cancellationToken);
            Dictionary<(Guid PropertyId, Guid MaterialId), decimal> available = balances
                .GroupBy(x => (locations[x.LocationId].PropertyId, x.MaterialId))
                .ToDictionary(x => x.Key, x => x.Sum(y => y.OnHandQty));

            List<string> groups = materials.Values
                .Where(x => !string.IsNullOrWhiteSpace(x.MaterialGroup))
                .Select(x => x.MaterialGroup)
                .Distinct()
                .ToList();
            List<Guid> stockedIds = balances.Where(x => x.OnHandQty > 0).Select(x => x.MaterialId).Distinct().ToList();
            List<ItemBuyerMaster> inStock = groups.Count == 0 || stockedIds.Count == 0
                ? new List<ItemBuyerMaster>()
                : await repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.IsInventoryItem
                        && stockedIds.Contains(x.Id) && groups.Contains(x.MaterialGroup))
                    .ToListAsync(cancellationToken);
            foreach (ItemBuyerMaster material in inStock)
            {
                materials.TryAdd(material.Id, material);
            }

            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(repository, materials.Keys, cancellationToken);
            Dictionary<(Guid PropertyId, Guid MaterialId), decimal> outletMinimum = await LoadOutletMinimumAsync(
                repository, locations, ingredientMaterialIds, cancellationToken);

            return new SilaSubstitutionContext(byId, ingredients, prices, locations, available, outletMinimum, materials, inStock, conversions);
        }

        /// <summary>The current month's minimum stock of the ingredients summed over the outlets of each property.</summary>
        private static async Task<Dictionary<(Guid PropertyId, Guid MaterialId), decimal>> LoadOutletMinimumAsync(
            IRepositoryWrapper repository, Dictionary<Guid, InventoryLocation> locations, List<Guid> materialIds, CancellationToken cancellationToken)
        {
            List<Guid> outletIds = locations.Values.Where(x => x.LocationType == Common.SILA_LOCATION_OUTLET).Select(x => x.Id).ToList();
            if (outletIds.Count == 0 || materialIds.Count == 0)
            {
                return new Dictionary<(Guid, Guid), decimal>();
            }

            List<InventoryLocationMaterial> rows = await repository.InventoryLocationMaterial
                .FindByCondition(x => x.IsActive && outletIds.Contains(x.LocationId) && materialIds.Contains(x.MaterialId))
                .ToListAsync(cancellationToken);
            int month = DateTime.UtcNow.Month;
            Dictionary<(Guid LocationMaterialId, int Month), LocationMaterialThreshold> thresholds = await SilaStockLevels.GetThresholdsAsync(
                repository, rows.Select(x => x.Id).ToList(), month, cancellationToken);
            return rows
                .Select(x => (Row: x, Minimum: SilaStockLevels.Effective(x, thresholds, month).MinimumStock ?? 0))
                .Where(x => x.Minimum > 0)
                .GroupBy(x => (locations[x.Row.LocationId].PropertyId, x.Row.MaterialId))
                .ToDictionary(x => x.Key, x => x.Sum(y => y.Minimum));
        }
    }
}
