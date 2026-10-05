using System.Text;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Recipe-level checks of the workbook and NEW / CHANGED / UNCHANGED classification.</summary>
    public static partial class SilaRecipeImport
    {
        private static void CheckGroups(List<Group> groups, Lookups lookups)
        {
            Dictionary<string, string> posInFile = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (Group group in groups)
            {
                int firstRow = group.Rows.Count > 0 ? group.Rows[0] : 0;
                SilaRecipeWriteDto request = group.Request;
                List<SilaRecipeIngredientWriteDto> lines = request.Ingredients;
                if (lines.Count == 0 && group.IsValid)
                {
                    group.AddError(firstRow, "The recipe has no valid ingredient row.");
                }

                if (lines.Count > MAX_INGREDIENTS)
                {
                    group.AddError(firstRow, $"A recipe has at most {MAX_INGREDIENTS} ingredients.");
                }

                if (request.ItemMode == Common.SILA_RECIPE_DIRECT && (lines.Count != 1 || lines[0].MaterialId == null))
                {
                    group.AddError(firstRow, "A DIRECT item has exactly one material row.");
                }

                if (request.ItemMode != Common.SILA_RECIPE_BATCH && lines.Any(x => x.SubRecipeId != null))
                {
                    group.AddError(firstRow, "Only a BATCH recipe can contain a sub-recipe.");
                }

                if (group.Existing != null && lines.Any(x => x.SubRecipeId == group.Existing.Id))
                {
                    group.AddError(firstRow, "A recipe cannot contain itself.");
                }

                bool repeated = lines.Where(x => x.MaterialId != null).GroupBy(x => x.MaterialId).Any(x => x.Count() > 1)
                    || lines.Where(x => x.SubRecipeId != null).GroupBy(x => x.SubRecipeId).Any(x => x.Count() > 1);
                if (repeated)
                {
                    group.AddError(firstRow, "An ingredient appears twice. Put each material once with its total quantity.");
                }

                string? pos = string.IsNullOrWhiteSpace(request.PosCode) ? null : request.PosCode.Trim();
                if (pos == null)
                {
                    continue;
                }

                if (posInFile.TryGetValue(pos, out string? other))
                {
                    group.AddError(firstRow, $"POS code {pos} is also used by {other} in this file.");
                }
                else
                {
                    posInFile[pos] = group.RecipeCode ?? request.Name;
                }

                if (lookups.PosCodes.TryGetValue(pos, out Guid owner) && owner != group.Existing?.Id)
                {
                    group.AddError(firstRow, $"POS code {pos} belongs to another active recipe.");
                }
            }
        }

        /// <summary>NEW without an existing recipe; CHANGED when the latest version differs from the file; otherwise UNCHANGED.</summary>
        private static async Task ClassifyAsync(IRepositoryWrapper repository, Guid buyerId, List<Group> groups, CancellationToken cancellationToken)
        {
            List<Group> existing = groups.Where(x => x.Existing != null && x.IsValid).ToList();
            SilaRecipeReadiness rows = await SilaRecipeReadiness.LoadAsync(repository, buyerId, existing.Select(x => x.Existing!.Id).ToList(), cancellationToken);
            foreach (Group group in groups)
            {
                if (group.Existing == null)
                {
                    group.Action = ACTION_NEW;
                    continue;
                }

                Recipe recipe = group.Existing;
                SilaRecipeWriteDto current = new SilaRecipeWriteDto
                {
                    Name = SilaRecipeRules.LatestName(recipe),
                    Description = recipe.Description,
                    ItemMode = recipe.ItemMode,
                    ServingQty = SilaRecipeRules.LatestServingQty(recipe),
                    ServingUom = SilaRecipeRules.LatestServingUom(recipe),
                    SellingUom = SilaRecipeRules.LatestSellingUom(recipe),
                    PosCode = SilaRecipeRules.LatestPosCode(recipe),
                    FamilyId = recipe.FamilyId,
                    CategoryId = recipe.CategoryId,
                    Ingredients = rows.IngredientsOf(recipe.Id, recipe.Version)
                        .Select(x => new SilaRecipeIngredientWriteDto { MaterialId = x.MaterialId, SubRecipeId = x.SubRecipeId, Quantity = x.Quantity, Uom = x.Uom })
                        .ToList(),
                    OutletPrices = rows.PricesOf(recipe.Id, recipe.Version)
                        .Select(x => new SilaRecipeOutletPriceWriteDto { OutletLocationId = x.OutletLocationId, MenuPrice = x.MenuPrice })
                        .ToList()
                };
                group.Action = Signature(current) == Signature(group.Request) ? ACTION_UNCHANGED : ACTION_CHANGED;
            }
        }

        private static string Signature(SilaRecipeWriteDto request)
        {
            StringBuilder text = new StringBuilder();
            text.Append(request.Name.Trim()).Append('|')
                .Append(request.Description?.Trim()).Append('|')
                .Append(request.ItemMode.Trim().ToUpperInvariant()).Append('|')
                .Append(Text(request.ServingQty)).Append('|')
                .Append(request.ServingUom.Trim().ToUpperInvariant()).Append('|')
                .Append(string.IsNullOrWhiteSpace(request.SellingUom) ? "EA" : request.SellingUom.Trim().ToUpperInvariant()).Append('|')
                .Append(request.PosCode?.Trim()).Append('|')
                .Append(request.FamilyId).Append('|')
                .Append(request.CategoryId).Append('|');
            foreach (SilaRecipeIngredientWriteDto line in request.Ingredients)
            {
                text.Append(line.MaterialId).Append(line.SubRecipeId).Append(':').Append(Text(line.Quantity)).Append(':')
                    .Append(line.Uom?.Trim().ToUpperInvariant()).Append(';');
            }

            text.Append('|');
            foreach (SilaRecipeOutletPriceWriteDto price in request.OutletPrices.OrderBy(x => x.OutletLocationId))
            {
                text.Append(price.OutletLocationId).Append(':').Append(Text(price.MenuPrice)).Append(';');
            }

            return text.ToString();
        }
    }
}
