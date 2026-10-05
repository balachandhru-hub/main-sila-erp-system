using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Whether recipe versions are ready for approval. Loaded once for a set of recipes (batch lookups), then evaluated per
    /// recipe version: ingredients present, every material with an approved unit cost and no price change waiting,
    /// every ingredient unit convertible to the material's base unit, a DIRECT item with exactly one ingredient, sub-recipes
    /// with an approved version, and at least one outlet menu price.
    /// </summary>
    public class SilaRecipeReadiness
    {
        public const string PRICE_APPROVED = "APPROVED";
        public const string PRICE_MISSING = "MISSING";
        public const string PRICE_PENDING = "PENDING_APPROVAL";

        private readonly Dictionary<Guid, List<RecipeIngredient>> _ingredients;
        private readonly Dictionary<Guid, List<RecipeOutletPrice>> _prices;
        private readonly Dictionary<Guid, ItemBuyerMaster> _materials;
        private readonly Dictionary<Guid, List<MaterialUomConversion>> _conversions;
        private readonly HashSet<Guid> _pendingPriceMaterials;
        private readonly Dictionary<Guid, decimal> _proposedPrices;
        private readonly Dictionary<Guid, Recipe> _subRecipes;

        private SilaRecipeReadiness(
            Dictionary<Guid, List<RecipeIngredient>> ingredients,
            Dictionary<Guid, List<RecipeOutletPrice>> prices,
            Dictionary<Guid, ItemBuyerMaster> materials,
            Dictionary<Guid, List<MaterialUomConversion>> conversions,
            Dictionary<Guid, decimal> proposedPrices,
            Dictionary<Guid, Recipe> subRecipes)
        {
            _proposedPrices = proposedPrices;
            _ingredients = ingredients;
            _prices = prices;
            _materials = materials;
            _conversions = conversions;
            _pendingPriceMaterials = proposedPrices.Keys.ToHashSet();
            _subRecipes = subRecipes;
        }

        /// <summary>Loads the active rows of every version of the recipes and what their checks need, in a fixed number of queries.</summary>
        public static async Task<SilaRecipeReadiness> LoadAsync(
            IRepositoryWrapper repository, Guid buyerId, IReadOnlyCollection<Guid> recipeIds, CancellationToken cancellationToken)
        {
            List<Guid> ids = recipeIds.Distinct().ToList();
            List<RecipeIngredient> ingredients = ids.Count == 0
                ? new List<RecipeIngredient>()
                : await repository.RecipeIngredient
                    .FindByCondition(x => ids.Contains(x.RecipeId) && x.IsActive)
                    .ToListAsync(cancellationToken);
            List<RecipeOutletPrice> prices = ids.Count == 0
                ? new List<RecipeOutletPrice>()
                : await repository.RecipeOutletPrice
                    .FindByCondition(x => ids.Contains(x.RecipeId) && x.IsActive)
                    .ToListAsync(cancellationToken);

            List<Guid> materialIds = ingredients.Where(x => x.MaterialId != null).Select(x => x.MaterialId!.Value).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = materialIds.Count == 0
                ? new Dictionary<Guid, ItemBuyerMaster>()
                : await repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && materialIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(repository, materialIds, cancellationToken);
            var pending = materialIds.Count == 0
                ? new List<(Guid MaterialId, decimal Proposed, DateTime Created)>()
                : (await repository.MaterialPriceChange
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == Common.SILA_PRICE_PENDING_APPROVAL && materialIds.Contains(x.MaterialId))
                    .Select(x => new { x.MaterialId, x.ProposedUnitCost, x.DateCreated })
                    .ToListAsync(cancellationToken))
                    .Select(x => (MaterialId: x.MaterialId, Proposed: x.ProposedUnitCost, Created: x.DateCreated))
                    .ToList();

            List<Guid> subIds = ingredients.Where(x => x.SubRecipeId != null).Select(x => x.SubRecipeId!.Value).Distinct().ToList();
            Dictionary<Guid, Recipe> subRecipes = subIds.Count == 0
                ? new Dictionary<Guid, Recipe>()
                : await repository.Recipe
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && subIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);

            return new SilaRecipeReadiness(
                ingredients.GroupBy(x => x.RecipeId).ToDictionary(x => x.Key, x => x.OrderBy(y => y.Sequence).ToList()),
                prices.GroupBy(x => x.RecipeId).ToDictionary(x => x.Key, x => x.ToList()),
                materials,
                conversions,
                pending.GroupBy(x => x.MaterialId).ToDictionary(x => x.Key, x => x.OrderByDescending(y => y.Created).First().Proposed),
                subRecipes);
        }

        public List<RecipeIngredient> IngredientsOf(Guid recipeId, int version)
        {
            return _ingredients.TryGetValue(recipeId, out List<RecipeIngredient>? rows)
                ? rows.Where(x => x.Version == version).ToList()
                : new List<RecipeIngredient>();
        }

        public List<RecipeOutletPrice> PricesOf(Guid recipeId, int version)
        {
            return _prices.TryGetValue(recipeId, out List<RecipeOutletPrice>? rows)
                ? rows.Where(x => x.Version == version).ToList()
                : new List<RecipeOutletPrice>();
        }

        public ItemBuyerMaster? MaterialOf(RecipeIngredient ingredient)
        {
            return ingredient.MaterialId != null && _materials.TryGetValue(ingredient.MaterialId.Value, out ItemBuyerMaster? material) ? material : null;
        }

        public List<MaterialUomConversion> ConversionsOf(Guid materialId)
        {
            return _conversions.TryGetValue(materialId, out List<MaterialUomConversion>? list) ? list : new List<MaterialUomConversion>();
        }

        /// <summary>The unit cost waiting for approval for the material, or null.</summary>
        public decimal? ProposedPriceOf(Guid materialId)
        {
            return _proposedPrices.TryGetValue(materialId, out decimal proposed) ? proposed : null;
        }

        /// <summary>A material price change may be requested: no change is waiting for approval.</summary>
        public bool CanUpdatePrice(Guid materialId)
        {
            return !_pendingPriceMaterials.Contains(materialId);
        }

        /// <summary>"1 CS = 12 EA; 1 BTL = 750 ML": the material's unit conversions to its base unit.</summary>
        public static string? PackSummary(List<MaterialUomConversion> conversions)
        {
            List<string> parts = conversions
                .Where(x => x.Factor > 0)
                .Select(x => $"1 {x.FromUom} = {x.Factor.ToString("0.####", System.Globalization.CultureInfo.InvariantCulture)} {x.ToUom}")
                .ToList();
            return parts.Count == 0 ? null : string.Join("; ", parts);
        }

        /// <summary>APPROVED, MISSING or PENDING_APPROVAL for a material ingredient; null for a sub-recipe.</summary>
        public string? PriceStatusOf(RecipeIngredient ingredient)
        {
            ItemBuyerMaster? material = MaterialOf(ingredient);
            if (material == null)
            {
                return ingredient.MaterialId == null ? null : PRICE_MISSING;
            }

            return PriceStatus(material, _pendingPriceMaterials.Contains(material.Id));
        }

        public static string PriceStatus(ItemBuyerMaster material, bool pendingChange)
        {
            if (pendingChange)
            {
                return PRICE_PENDING;
            }

            return material.UnitCost != null && material.UnitCost > 0 ? PRICE_APPROVED : PRICE_MISSING;
        }

        /// <summary>The base quantity of the line with today's conversions; null when the unit cannot be converted.</summary>
        public decimal? BaseQuantityOf(RecipeIngredient ingredient)
        {
            ItemBuyerMaster? material = MaterialOf(ingredient);
            if (material == null)
            {
                return ingredient.MaterialId == null ? ingredient.BaseQuantity : null;
            }

            return TryToBase(material, ingredient.Quantity, ingredient.Uom, ConversionsOf(material.Id));
        }

        /// <summary>The readiness problem of one line, or null.</summary>
        public string? LineIssue(RecipeIngredient ingredient)
        {
            if (ingredient.SubRecipeId != null)
            {
                bool active = _subRecipes.TryGetValue(ingredient.SubRecipeId.Value, out Recipe? sub)
                    && sub.ActiveVersion > 0
                    && sub.Status != Common.SILA_RECIPE_INACTIVE;
                return active ? null : "Sub-recipe has no approved version";
            }

            ItemBuyerMaster? material = MaterialOf(ingredient);
            if (material == null)
            {
                return "Material is inactive or missing";
            }

            string status = PriceStatus(material, _pendingPriceMaterials.Contains(material.Id));
            if (status == PRICE_PENDING)
            {
                return "Material price pending approval";
            }

            if (status == PRICE_MISSING)
            {
                return "Price missing";
            }

            return BaseQuantityOf(ingredient) == null ? $"UOM conversion missing ({ingredient.Uom} to {UomConverter.BaseUomOf(material)})" : null;
        }

        public SilaRecipeReadinessDto Evaluate(Recipe recipe, int version)
        {
            List<RecipeIngredient> ingredients = IngredientsOf(recipe.Id, version);
            List<string> issues = new List<string>();
            bool costComplete = ingredients.Count > 0;
            if (ingredients.Count == 0)
            {
                issues.Add("No ingredients");
            }

            foreach (RecipeIngredient ingredient in ingredients)
            {
                string? issue = LineIssue(ingredient);
                if (issue != null)
                {
                    costComplete = false;
                    issues.Add($"{ingredient.ItemCode} {ingredient.ItemName}: {issue}");
                }
            }

            if (recipe.ItemMode == Common.SILA_RECIPE_DIRECT && ingredients.Count != 1)
            {
                issues.Add("A DIRECT item needs exactly one ingredient");
            }

            if (PricesOf(recipe.Id, version).Count == 0)
            {
                issues.Add("No outlet menu price");
            }

            return new SilaRecipeReadinessDto
            {
                Ready = issues.Count == 0,
                CostComplete = costComplete,
                Issues = issues,
                Status = SilaRecipeRules.ReadinessStatus(recipe, version, issues.Count == 0, issues.Count)
            };
        }

        /// <summary>Like UomConverter.ToBase, but returns null instead of throwing when no conversion exists.</summary>
        public static decimal? TryToBase(ItemBuyerMaster material, decimal quantity, string? uom, List<MaterialUomConversion> conversions)
        {
            string baseUom = UomConverter.BaseUomOf(material);
            string unit = string.IsNullOrWhiteSpace(uom) ? baseUom : uom.Trim().ToUpperInvariant();
            if (unit == baseUom)
            {
                return quantity;
            }

            MaterialUomConversion? forward = conversions.FirstOrDefault(x => Same(x.FromUom, unit) && Same(x.ToUom, baseUom) && x.Factor > 0);
            if (forward != null)
            {
                return quantity * forward.Factor;
            }

            MaterialUomConversion? backward = conversions.FirstOrDefault(x => Same(x.FromUom, baseUom) && Same(x.ToUom, unit) && x.Factor > 0);
            return backward != null ? quantity / backward.Factor : null;
        }

        private static bool Same(string left, string right)
        {
            return string.Equals(left.Trim(), right, StringComparison.OrdinalIgnoreCase);
        }
    }
}
