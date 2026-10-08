using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Row validation of the recipe workbook.</summary>
    public static partial class SilaRecipeImport
    {
        private const int MAX_NAME = 200;
        private const int MAX_CODE = 50;
        private const int MAX_INGREDIENTS = 100;

        /// <summary>The buyer's data the workbook refers to, loaded once.</summary>
        private class Lookups
        {
            public Dictionary<string, Recipe> Recipes { get; private set; } = new(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, Guid> PosCodes { get; private set; } = new(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, Guid> Families { get; private set; } = new(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, Guid> Categories { get; private set; } = new(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, ItemBuyerMaster> Materials { get; private set; } = new(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, InventoryLocation> Outlets { get; private set; } = new(StringComparer.OrdinalIgnoreCase);

            public static async Task<Lookups> LoadAsync(
                IRepositoryWrapper repository,
                Guid buyerId,
                List<Dictionary<string, string>> recipeRows,
                List<Dictionary<string, string>> priceRows,
                CancellationToken cancellationToken)
            {
                List<string> materialCodes = recipeRows.Select(x => SilaRecipeExcel.Value(x, "MaterialCode")).Where(x => x != null).Select(x => x!).Distinct().ToList();
                List<string> outletCodes = priceRows.Select(x => SilaRecipeExcel.Value(x, "OutletCode")).Where(x => x != null).Select(x => x!).Distinct().ToList();
                List<Recipe> recipes = await repository.Recipe.FindByCondition(x => x.BuyerId == buyerId && x.IsActive).ToListAsync(cancellationToken);
                List<ItemBuyerMaster> materials = materialCodes.Count == 0
                    ? new List<ItemBuyerMaster>()
                    : await repository.ItemBuyerMaster
                        .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && materialCodes.Contains(x.MaterialCode))
                        .ToListAsync(cancellationToken);
                List<InventoryLocation> outlets = outletCodes.Count == 0
                    ? new List<InventoryLocation>()
                    : await repository.InventoryLocation
                        .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.LocationType == Common.SILA_LOCATION_OUTLET && outletCodes.Contains(x.LocationCode))
                        .ToListAsync(cancellationToken);

                Lookups lookups = new Lookups();
                foreach (Recipe recipe in recipes)
                {
                    lookups.Recipes[recipe.RecipeCode] = recipe;
                    if (!string.IsNullOrWhiteSpace(recipe.PosCode) && recipe.Status != Common.SILA_RECIPE_INACTIVE)
                    {
                        lookups.PosCodes[recipe.PosCode.Trim()] = recipe.Id;
                    }

                    // A POS code in a version waiting for approval is reserved too.
                    if (!string.IsNullOrWhiteSpace(recipe.DraftPosCode) && recipe.Status != Common.SILA_RECIPE_INACTIVE)
                    {
                        lookups.PosCodes[recipe.DraftPosCode.Trim()] = recipe.Id;
                    }
                }

                foreach (RecipeFamily family in await repository.RecipeFamily.FindByCondition(x => x.BuyerId == buyerId && x.IsActive).ToListAsync(cancellationToken))
                {
                    lookups.Families[family.Code] = family.Id;
                }

                foreach (RecipeCategory category in await repository.RecipeCategory.FindByCondition(x => x.BuyerId == buyerId && x.IsActive).ToListAsync(cancellationToken))
                {
                    lookups.Categories[category.Code] = category.Id;
                }

                foreach (ItemBuyerMaster material in materials)
                {
                    lookups.Materials[material.MaterialCode] = material;
                }

                foreach (InventoryLocation outlet in outlets)
                {
                    lookups.Outlets[outlet.LocationCode] = outlet;
                }

                return lookups;
            }
        }

        private static Group StartGroup(string key, Dictionary<string, string> row, int rowNumber, Lookups lookups)
        {
            Group group = new Group { Key = key, RecipeCode = SilaRecipeExcel.Value(row, "RecipeCode")?.ToUpperInvariant() };
            if (group.RecipeCode != null)
            {
                if (!lookups.Recipes.TryGetValue(group.RecipeCode, out Recipe? existing))
                {
                    group.AddError(rowNumber, $"Recipe code {group.RecipeCode} does not exist. Leave RecipeCode empty to create a new recipe.");
                }
                else if (existing.Status == Common.SILA_RECIPE_PENDING_APPROVAL)
                {
                    group.AddError(rowNumber, "The recipe is waiting for approval and cannot be changed now.");
                }
                else if (existing.Status == Common.SILA_RECIPE_INACTIVE)
                {
                    group.AddError(rowNumber, "The recipe is inactive and cannot be changed.");
                }
                else
                {
                    group.Existing = existing;
                }
            }

            string name = SilaRecipeExcel.Value(row, "Name") ?? (group.Existing == null ? null : SilaRecipeRules.LatestName(group.Existing)) ?? string.Empty;
            string mode = (SilaRecipeExcel.Value(row, "ItemMode") ?? string.Empty).ToUpperInvariant();
            decimal? servingQty = Number(row, "ServingQty");
            string? servingUom = SilaRecipeExcel.Value(row, "ServingUom")?.ToUpperInvariant();
            string? posCode = SilaRecipeExcel.Value(row, "PosCode");
            group.Request = new SilaRecipeWriteDto
            {
                Name = name,
                Description = SilaRecipeExcel.Value(row, "Description"),
                ItemMode = mode,
                ServingQty = servingQty ?? 0,
                ServingUom = servingUom ?? string.Empty,
                SellingUom = SilaRecipeExcel.Value(row, "SellingUom")?.ToUpperInvariant(),
                PosCode = posCode,
                Currency = SilaRecipeExcel.Value(row, "Currency")?.ToUpperInvariant(),
                Ingredients = new List<SilaRecipeIngredientWriteDto>(),
                OutletPrices = new List<SilaRecipeOutletPriceWriteDto>()
            };

            if (name.Length == 0 || name.Length > MAX_NAME)
            {
                group.AddError(rowNumber, $"Name is required (at most {MAX_NAME} characters).");
            }

            if (mode != Common.SILA_RECIPE_DIRECT && mode != Common.SILA_RECIPE_RECIPE && mode != Common.SILA_RECIPE_BATCH)
            {
                group.AddError(rowNumber, "ItemMode must be DIRECT, RECIPE or BATCH.");
            }

            if (servingQty == null || servingQty <= 0 || servingUom == null)
            {
                group.AddError(rowNumber, "ServingQty must be a number greater than zero and ServingUom is required.");
            }

            if ((posCode?.Length ?? 0) > MAX_CODE)
            {
                group.AddError(rowNumber, $"PosCode must be at most {MAX_CODE} characters.");
            }

            string? family = SilaRecipeExcel.Value(row, "Family");
            if (family != null)
            {
                if (lookups.Families.TryGetValue(family, out Guid familyId))
                {
                    group.Request.FamilyId = familyId;
                }
                else
                {
                    group.AddError(rowNumber, $"Family {family} does not exist. Use a family code from Recipe master data.");
                }
            }

            string? category = SilaRecipeExcel.Value(row, "Category");
            if (category != null)
            {
                if (lookups.Categories.TryGetValue(category, out Guid categoryId))
                {
                    group.Request.CategoryId = categoryId;
                }
                else
                {
                    group.AddError(rowNumber, $"Category {category} does not exist. Use a category code from Recipe master data.");
                }
            }

            return group;
        }

        private static void AddIngredient(Group group, Dictionary<string, string> row, int rowNumber, Lookups lookups)
        {
            string? materialCode = SilaRecipeExcel.Value(row, "MaterialCode");
            string? subCode = SilaRecipeExcel.Value(row, "SubRecipeCode");
            decimal? quantity = Number(row, "Quantity");
            string? uom = SilaRecipeExcel.Value(row, "Uom")?.ToUpperInvariant();
            if ((materialCode == null) == (subCode == null))
            {
                group.AddError(rowNumber, "Fill either MaterialCode or SubRecipeCode.");
                return;
            }

            if (quantity == null || quantity <= 0)
            {
                group.AddError(rowNumber, "Quantity must be a number greater than zero.");
                return;
            }

            if (materialCode != null)
            {
                if (!lookups.Materials.TryGetValue(materialCode, out ItemBuyerMaster? material))
                {
                    group.AddError(rowNumber, $"Material {materialCode} is not an active Item Master material.");
                    return;
                }

                group.Request.Ingredients.Add(new SilaRecipeIngredientWriteDto
                {
                    MaterialId = material.Id,
                    Quantity = quantity.Value,
                    Uom = uom ?? UomConverter.BaseUomOf(material)
                });
                return;
            }

            if (!lookups.Recipes.TryGetValue(subCode!, out Recipe? sub) || sub.ActiveVersion <= 0 || sub.Status == Common.SILA_RECIPE_INACTIVE)
            {
                group.AddError(rowNumber, $"Sub-recipe {subCode} is not an approved recipe.");
                return;
            }

            group.Request.Ingredients.Add(new SilaRecipeIngredientWriteDto { SubRecipeId = sub.Id, Quantity = quantity.Value, Uom = sub.ServingUom });
        }

        private static void AddPrice(Group group, Dictionary<string, string> row, int rowNumber, Lookups lookups)
        {
            string? outletCode = SilaRecipeExcel.Value(row, "OutletCode");
            decimal? price = Number(row, "MenuPrice");
            if (outletCode == null || !lookups.Outlets.TryGetValue(outletCode, out InventoryLocation? outlet))
            {
                group.AddError(-rowNumber, $"Outlet {outletCode} is not an active outlet location.");
                return;
            }

            if (price == null || price <= 0)
            {
                group.AddError(-rowNumber, "MenuPrice must be a number greater than zero.");
                return;
            }

            if (group.Request.OutletPrices.Any(x => x.OutletLocationId == outlet.Id))
            {
                group.AddError(-rowNumber, $"Outlet {outletCode} is priced twice for this recipe.");
                return;
            }

            group.Request.OutletPrices.Add(new SilaRecipeOutletPriceWriteDto
            {
                OutletLocationId = outlet.Id,
                MenuPrice = price.Value,
                Currency = SilaRecipeExcel.Value(row, "Currency")?.ToUpperInvariant()
            });
        }
    }
}
