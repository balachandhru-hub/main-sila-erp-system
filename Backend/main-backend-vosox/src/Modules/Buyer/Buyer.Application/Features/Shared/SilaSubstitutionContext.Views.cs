using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>The review screen views of the substitution engine: ingredients with stock, suggestions with costs and margins.</summary>
    public partial class SilaSubstitutionContext
    {
        public const int SUGGESTIONS_PER_INGREDIENT = 3;

        /// <summary>The active version's ingredients with their stock in the property; short material lines are flagged.</summary>
        public List<SilaSubstitutionIngredientDto> IngredientViews(Guid recipeId, Guid? propertyId)
        {
            return IngredientsOf(recipeId).Select(x =>
            {
                ItemBuyerMaster? material = MaterialOf(x.MaterialId);
                bool isMaterial = x.MaterialId != null && propertyId != null;
                return new SilaSubstitutionIngredientDto
                {
                    MaterialId = x.MaterialId,
                    SubRecipeId = x.SubRecipeId,
                    ItemCode = x.ItemCode,
                    ItemName = x.ItemName,
                    MaterialGroup = material?.MaterialGroup,
                    Quantity = x.Quantity,
                    Uom = x.Uom,
                    BaseQuantity = x.BaseQuantity,
                    BaseUom = x.BaseUom,
                    UnitCost = x.UnitCost,
                    Cost = x.Cost,
                    Sequence = x.Sequence,
                    PropertyAvailableQty = isMaterial ? Available(propertyId!.Value, x.MaterialId!.Value) : null,
                    IsShort = isMaterial && IsShort(propertyId!.Value, x.MaterialId!.Value)
                };
            }).ToList();
        }

        /// <summary>The best suggestions for every short material ingredient of the recipe in the property.</summary>
        public List<SilaSubstitutionSuggestionDto> SuggestionViews(Guid recipeId, Guid propertyId, string? currency)
        {
            decimal total = ActiveCostOf(recipeId);
            List<SilaSubstitutionSuggestionDto> views = new List<SilaSubstitutionSuggestionDto>();
            foreach (RecipeIngredient ingredient in IngredientsOf(recipeId).Where(x => x.MaterialId != null))
            {
                if (!IsShort(propertyId, ingredient.MaterialId!.Value))
                {
                    continue;
                }

                List<SilaSubstitutionCandidate> best = Candidates(recipeId, ingredient, propertyId).Take(SUGGESTIONS_PER_INGREDIENT).ToList();
                for (int rank = 0; rank < best.Count; rank++)
                {
                    SilaSubstitutionCandidate candidate = best[rank];
                    decimal resultTotal = Math.Round(total + candidate.CostDelta, 4);
                    views.Add(new SilaSubstitutionSuggestionDto
                    {
                        ReplacesMaterialId = ingredient.MaterialId!.Value,
                        MaterialId = candidate.Material.Id,
                        MaterialCode = candidate.Material.MaterialCode ?? string.Empty,
                        Description = candidate.Material.Description ?? string.Empty,
                        MaterialGroup = candidate.Material.MaterialGroup,
                        BaseUom = UomConverter.BaseUomOf(candidate.Material),
                        UnitCost = candidate.Material.UnitCost,
                        Currency = candidate.Material.Currency ?? currency,
                        PropertyAvailableQty = candidate.Available,
                        Quantity = candidate.Quantity,
                        Uom = candidate.Uom,
                        BaseQuantity = candidate.BaseQuantity,
                        LineCost = candidate.LineCost,
                        CostDelta = candidate.CostDelta,
                        ResultTotalCost = resultTotal,
                        IsRecommended = rank == 0,
                        Outlets = OutletViews(recipeId, resultTotal, currency)
                    });
                }
            }

            return views;
        }

        /// <summary>Menu price, cost % and margin % at every priced outlet of the active version for a total cost.</summary>
        public List<SilaSubstitutionOutletDto> OutletViews(Guid recipeId, decimal totalCost, string? currency)
        {
            // Cost % and margin compare the cost of one serving with the menu price (a batch for n is sold per serving).
            decimal costPerServing = SilaRecipeRules.CostPerServing(totalCost, RecipeOf(recipeId)?.ServingQty ?? 1m);
            return PricesOf(recipeId)
                .Select(x => (Price: x, Location: LocationOf(x.OutletLocationId)))
                .Where(x => x.Location != null)
                .OrderBy(x => x.Location!.LocationCode)
                .Select(x => new SilaSubstitutionOutletDto
                {
                    OutletLocationId = x.Location!.Id,
                    LocationCode = x.Location.LocationCode,
                    LocationName = x.Location.LocationName,
                    MenuPrice = x.Price.MenuPrice,
                    Currency = x.Price.Currency ?? currency,
                    CostPercent = SilaRecipeRules.CostPercent(costPerServing, x.Price.MenuPrice),
                    MarginPercent = SilaRecipeRules.MarginPercent(costPerServing, x.Price.MenuPrice)
                })
                .ToList();
        }
    }
}
