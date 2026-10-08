using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>The shortage and candidate rules of the substitution engine (see SilaSubstitutionContext.LoadAsync).</summary>
    public partial class SilaSubstitutionContext
    {
        public Recipe? RecipeOf(Guid recipeId)
        {
            return _recipes.TryGetValue(recipeId, out Recipe? recipe) ? recipe : null;
        }

        /// <summary>Rows of the recipe's active (approved, selling) version.</summary>
        public List<RecipeIngredient> IngredientsOf(Guid recipeId)
        {
            return _ingredients.TryGetValue(recipeId, out List<RecipeIngredient>? rows) ? rows : new List<RecipeIngredient>();
        }

        public List<RecipeOutletPrice> PricesOf(Guid recipeId)
        {
            return _prices.TryGetValue(recipeId, out List<RecipeOutletPrice>? rows) ? rows : new List<RecipeOutletPrice>();
        }

        public decimal ActiveCostOf(Guid recipeId)
        {
            return Math.Round(IngredientsOf(recipeId).Sum(x => x.Cost), 4);
        }

        public ItemBuyerMaster? MaterialOf(Guid? materialId)
        {
            return materialId != null && _materials.TryGetValue(materialId.Value, out ItemBuyerMaster? material) ? material : null;
        }

        public InventoryLocation? LocationOf(Guid? locationId)
        {
            return locationId != null && _locations.TryGetValue(locationId.Value, out InventoryLocation? location) ? location : null;
        }

        /// <summary>The properties of the recipe's active priced outlets, each with its first outlet (by code).</summary>
        public List<InventoryLocation> FirstOutletPerProperty(Guid recipeId)
        {
            return PricesOf(recipeId)
                .Select(x => LocationOf(x.OutletLocationId))
                .Where(x => x != null)
                .Select(x => x!)
                .GroupBy(x => x.PropertyId)
                .Select(x => x.OrderBy(y => y.LocationCode).First())
                .ToList();
        }

        /// <summary>On hand across the active stores and outlets of the property, in the material's base unit.</summary>
        public decimal Available(Guid propertyId, Guid materialId)
        {
            return _available.TryGetValue((propertyId, materialId), out decimal quantity) ? quantity : 0;
        }

        /// <summary>The current month's minimum stock summed over the property's outlets (0 when none is set).</summary>
        public decimal OutletMinimum(Guid propertyId, Guid materialId)
        {
            return _outletMinimum.TryGetValue((propertyId, materialId), out decimal quantity) ? quantity : 0;
        }

        /// <summary>Short: nothing left in the property, or less than the outlets' minimum stock of this month.</summary>
        public bool IsShort(Guid propertyId, Guid materialId)
        {
            decimal available = Available(propertyId, materialId);
            decimal minimum = OutletMinimum(propertyId, materialId);
            return available <= 0 || (minimum > 0 && available < minimum);
        }

        public string ShortReason(Guid propertyId, ItemBuyerMaster material, string? propertyName)
        {
            string where = string.IsNullOrWhiteSpace(propertyName) ? "the property" : propertyName;
            string uom = UomConverter.BaseUomOf(material);
            decimal available = Available(propertyId, material.Id);
            if (available <= 0)
            {
                return $"{material.Description} is out of stock in every store and outlet of {where} ({available:0.####} {uom}).";
            }

            return $"{material.Description} has {available:0.####} {uom} across {where}, below the outlets' minimum of {OutletMinimum(propertyId, material.Id):0.####} {uom} this month.";
        }

        /// <summary>
        /// Every material that can replace the ingredient in the property, best first: same material group, inventory item,
        /// priced, in stock in the property, convertible to the ingredient's unit, not already an ingredient of the recipe.
        /// Ranked by the stock available, then by the line cost closest to the current one.
        /// </summary>
        public List<SilaSubstitutionCandidate> Candidates(Guid recipeId, RecipeIngredient ingredient, Guid propertyId)
        {
            ItemBuyerMaster? current = MaterialOf(ingredient.MaterialId);
            if (current == null || string.IsNullOrWhiteSpace(current.MaterialGroup))
            {
                return new List<SilaSubstitutionCandidate>();
            }

            HashSet<Guid> inRecipe = IngredientsOf(recipeId).Where(x => x.MaterialId != null).Select(x => x.MaterialId!.Value).ToHashSet();
            List<SilaSubstitutionCandidate> candidates = new List<SilaSubstitutionCandidate>();
            foreach (ItemBuyerMaster material in _inStockMaterials)
            {
                if (inRecipe.Contains(material.Id)
                    || !SameGroup(material.MaterialGroup, current.MaterialGroup)
                    || material.UnitCost == null
                    || material.UnitCost <= 0)
                {
                    continue;
                }

                decimal available = Available(propertyId, material.Id);
                if (available <= 0)
                {
                    continue;
                }

                SilaSubstitutionCandidate? line = CopyLine(ingredient, current, material);
                if (line == null)
                {
                    continue;
                }

                line.Available = available;
                candidates.Add(line);
            }

            return candidates
                .OrderByDescending(x => x.Available)
                .ThenBy(x => Math.Abs(x.CostDelta))
                .ThenBy(x => x.Material.MaterialCode)
                .ToList();
        }

        /// <summary>
        /// The substitute's line: the ingredient's quantity and unit when the substitute converts that unit, else the
        /// ingredient's base quantity in its base unit; null when the substitute converts neither.
        /// </summary>
        public SilaSubstitutionCandidate? CopyLine(RecipeIngredient ingredient, ItemBuyerMaster current, ItemBuyerMaster substitute)
        {
            List<MaterialUomConversion> conversions = ConversionsOf(substitute.Id);
            decimal quantity = ingredient.Quantity;
            string uom = string.IsNullOrWhiteSpace(ingredient.Uom) ? UomConverter.BaseUomOf(current) : ingredient.Uom.Trim().ToUpperInvariant();
            decimal? baseQuantity = SilaRecipeReadiness.TryToBase(substitute, quantity, uom, conversions);
            if (baseQuantity == null)
            {
                string currentBase = UomConverter.BaseUomOf(current);
                quantity = Math.Round(SilaRecipeReadiness.TryToBase(current, ingredient.Quantity, uom, ConversionsOf(current.Id)) ?? ingredient.BaseQuantity, 4);
                uom = currentBase;
                baseQuantity = SilaRecipeReadiness.TryToBase(substitute, quantity, uom, conversions);
            }

            if (baseQuantity == null || quantity <= 0)
            {
                return null;
            }

            decimal lineCost = Math.Round(baseQuantity.Value * (substitute.UnitCost ?? 0), 4);
            return new SilaSubstitutionCandidate
            {
                Material = substitute,
                Quantity = quantity,
                Uom = uom,
                BaseQuantity = baseQuantity.Value,
                LineCost = lineCost,
                CostDelta = Math.Round(lineCost - ingredient.Cost, 4)
            };
        }

        private List<MaterialUomConversion> ConversionsOf(Guid materialId)
        {
            return _conversions.TryGetValue(materialId, out List<MaterialUomConversion>? list) ? list : new List<MaterialUomConversion>();
        }

        private static bool SameGroup(string? left, string? right)
        {
            return !string.IsNullOrWhiteSpace(left)
                && !string.IsNullOrWhiteSpace(right)
                && string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);
        }
    }
}
