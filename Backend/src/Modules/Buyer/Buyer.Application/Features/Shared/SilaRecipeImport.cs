using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The recipe workbook: sheet "Recipes" with one row per ingredient (the recipe columns repeat on every row of the
    /// recipe) and sheet "OutletPrices" with one row per outlet menu price. Rows belong to the recipe of their RecipeCode,
    /// or, for a new recipe (RecipeCode empty), to the recipe of their Name. Reading validates every row against the
    /// buyer's data in batch lookups and decides per recipe: NEW, CHANGED (a new draft version, or the draft edited) or
    /// UNCHANGED.
    /// </summary>
    public static partial class SilaRecipeImport
    {
        public const string SHEET_RECIPES = "Recipes";
        public const string SHEET_PRICES = "OutletPrices";
        public const string ACTION_NEW = "NEW";
        public const string ACTION_CHANGED = "CHANGED";
        public const string ACTION_UNCHANGED = "UNCHANGED";

        public static readonly string[] RecipeColumns =
        {
            "RecipeCode", "Name", "Family", "Category", "ItemMode", "ServingQty", "ServingUom", "SellingUom", "PosCode", "Currency",
            "Description", "MaterialCode", "SubRecipeCode", "Quantity", "Uom", "Version", "Status"
        };

        public static readonly string[] PriceColumns = { "RecipeCode", "Name", "OutletCode", "MenuPrice", "Currency" };

        private static readonly string[] RequiredRecipeColumns = { "RecipeCode", "Name", "ItemMode", "ServingQty", "ServingUom", "MaterialCode", "Quantity", "Uom" };
        private static readonly string[] RequiredPriceColumns = { "RecipeCode", "Name", "OutletCode", "MenuPrice" };

        /// <summary>One recipe of the workbook, its rows, what is wrong and the write request built from it.</summary>
        public class Group
        {
            public string Key { get; set; } = string.Empty;
            public string? RecipeCode { get; set; }
            public Recipe? Existing { get; set; }
            public List<int> Rows { get; set; } = new();
            public Dictionary<int, List<string>> Errors { get; set; } = new();
            public SilaRecipeWriteDto Request { get; set; } = new();
            public string Action { get; set; } = ACTION_NEW;

            public bool IsValid => Errors.Count == 0;

            public void AddError(int row, string message)
            {
                if (!Errors.TryGetValue(row, out List<string>? list))
                {
                    list = new List<string>();
                    Errors[row] = list;
                }

                list.Add(message);
            }
        }

        /// <summary>Reads, validates and classifies the workbook. Rows of the price sheet are counted in TotalRows too.</summary>
        public static async Task<(List<Group> Groups, SilaRecipeImportPreviewDto Preview)> ReadAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, string fileName, byte[] content, CancellationToken cancellationToken)
        {
            SilaRecipeExcel.EnsureWorkbook(logger, fileName, content);
            List<Dictionary<string, string>> recipeRows = SilaRecipeExcel.ReadSheet(logger, fileName, content, SHEET_RECIPES, RequiredRecipeColumns);
            if (recipeRows.Count == 0)
            {
                recipeRows = SilaRecipeExcel.ReadSheet(logger, fileName, content, null, RequiredRecipeColumns);
            }

            List<Dictionary<string, string>> priceRows = SilaRecipeExcel.ReadSheet(logger, fileName, content, SHEET_PRICES, RequiredPriceColumns);
            Lookups lookups = await Lookups.LoadAsync(repository, buyerId, recipeRows, priceRows, cancellationToken);

            Dictionary<string, Group> groups = new Dictionary<string, Group>(StringComparer.OrdinalIgnoreCase);
            List<SilaRecipeImportErrorDto> orphanErrors = new List<SilaRecipeImportErrorDto>();
            foreach (Dictionary<string, string> row in recipeRows)
            {
                string? key = KeyOf(row);
                int rowNumber = SilaRecipeExcel.RowNumber(row);
                if (key == null)
                {
                    orphanErrors.Add(new SilaRecipeImportErrorDto { Sheet = SHEET_RECIPES, Row = rowNumber, Message = "RecipeCode or Name is required." });
                    continue;
                }

                if (!groups.TryGetValue(key, out Group? group))
                {
                    group = StartGroup(key, row, rowNumber, lookups);
                    groups[key] = group;
                }

                group.Rows.Add(rowNumber);
                AddIngredient(group, row, rowNumber, lookups);
            }

            foreach (Dictionary<string, string> row in priceRows)
            {
                string? key = KeyOf(row);
                int rowNumber = SilaRecipeExcel.RowNumber(row);
                if (key == null || !groups.TryGetValue(key, out Group? group))
                {
                    orphanErrors.Add(new SilaRecipeImportErrorDto
                    {
                        Sheet = SHEET_PRICES,
                        Row = rowNumber,
                        Message = "The price row has no recipe in the Recipes sheet. Use the same RecipeCode (or Name for a new recipe)."
                    });
                    continue;
                }

                AddPrice(group, row, rowNumber, lookups);
            }

            List<Group> list = groups.Values.ToList();
            CheckGroups(list, lookups);
            await ClassifyAsync(repository, buyerId, list, cancellationToken);
            return (list, BuildPreview(fileName, recipeRows.Count + priceRows.Count, list, orphanErrors));
        }

        private static string? KeyOf(Dictionary<string, string> row)
        {
            string? code = SilaRecipeExcel.Value(row, "RecipeCode");
            if (code != null)
            {
                return code.ToUpperInvariant();
            }

            string? name = SilaRecipeExcel.Value(row, "Name");
            return name == null ? null : $"NEW:{name.ToUpperInvariant()}";
        }

        private static SilaRecipeImportPreviewDto BuildPreview(string fileName, int totalRows, List<Group> groups, List<SilaRecipeImportErrorDto> orphanErrors)
        {
            SilaRecipeImportPreviewDto preview = new SilaRecipeImportPreviewDto { FileName = Path.GetFileName(fileName), TotalRows = totalRows };
            List<SilaRecipeImportErrorDto> errors = new List<SilaRecipeImportErrorDto>(orphanErrors);
            foreach (Group group in groups)
            {
                errors.AddRange(group.Errors.Select(x => new SilaRecipeImportErrorDto
                {
                    Sheet = x.Key < 0 ? SHEET_PRICES : SHEET_RECIPES,
                    Row = Math.Abs(x.Key),
                    Message = $"{group.RecipeCode ?? group.Request.Name}: {string.Join(" ", x.Value)}"
                }));
                if (!group.IsValid)
                {
                    continue;
                }

                if (group.Action == ACTION_NEW)
                {
                    preview.NewCount++;
                }
                else if (group.Action == ACTION_CHANGED)
                {
                    preview.ChangedCount++;
                }
                else
                {
                    preview.UnchangedCount++;
                }
            }

            preview.InvalidRows = errors.Select(x => (x.Sheet, x.Row)).Distinct().Count();
            preview.ValidRows = Math.Max(0, totalRows - preview.InvalidRows);
            preview.Errors = errors.OrderBy(x => x.Sheet).ThenBy(x => x.Row).Take(SilaRecipeExcel.MAX_ERRORS).ToList();
            return preview;
        }

        private static decimal? Number(Dictionary<string, string> row, string column)
        {
            return SilaRecipeExcel.Number(SilaRecipeExcel.Value(row, column));
        }

        private static string Text(decimal value)
        {
            return value.ToString("0.####", CultureInfo.InvariantCulture);
        }
    }
}
