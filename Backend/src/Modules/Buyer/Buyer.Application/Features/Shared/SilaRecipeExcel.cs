using System.Globalization;
using Buyer.Domain.Dtos;
using ClosedXML.Excel;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Excel workbooks of the recipe area (recipes, families, categories): building templates and exports, and reading an
    /// upload into rows of column name to text. Uploads must be real .xlsx files (ZIP signature), at most 5 MB and
    /// <see cref="MAX_ROWS"/> data rows per sheet.
    /// </summary>
    public static class SilaRecipeExcel
    {
        public const string CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        public const int MAX_BYTES = 5 * 1024 * 1024;
        public const int MAX_ROWS = 5000;
        /// <summary>Row errors returned in a preview.</summary>
        public const int MAX_ERRORS = 200;
        public const string ROW_KEY = "#ROW";

        /// <summary>A sheet to write: name, header row and data rows.</summary>
        public class Sheet
        {
            public string Name { get; set; } = string.Empty;
            public IReadOnlyList<string> Headers { get; set; } = Array.Empty<string>();
            public List<object?[]> Rows { get; set; } = new();
        }

        public static SilaRecipeFileDto Build(string fileName, params Sheet[] sheets)
        {
            using XLWorkbook workbook = new XLWorkbook();
            foreach (Sheet definition in sheets)
            {
                IXLWorksheet sheet = workbook.Worksheets.Add(definition.Name);
                for (int column = 0; column < definition.Headers.Count; column++)
                {
                    sheet.Cell(1, column + 1).Value = definition.Headers[column];
                    sheet.Cell(1, column + 1).Style.Font.Bold = true;
                }

                int rowNumber = 1;
                foreach (object?[] row in definition.Rows)
                {
                    rowNumber++;
                    for (int column = 0; column < row.Length && column < definition.Headers.Count; column++)
                    {
                        sheet.Cell(rowNumber, column + 1).Value = ToCellValue(row[column]);
                    }
                }

                sheet.Columns().AdjustToContents();
            }

            using MemoryStream stream = new MemoryStream();
            workbook.SaveAs(stream);
            return new SilaRecipeFileDto { Content = stream.ToArray(), ContentType = CONTENT_TYPE, FileName = fileName };
        }

        /// <summary>Refuses an upload that is empty, too large or not an .xlsx workbook.</summary>
        public static void EnsureWorkbook(ILoggerManager logger, string? fileName, byte[] content)
        {
            SilaFileRules.Validate(logger, "Recipe workbook", fileName, content, new[] { SilaFileRules.KIND_XLSX }, MAX_BYTES);
        }

        /// <summary>
        /// The data rows of one sheet (by name, or the first sheet when the name is null), each as normalised column name to
        /// text with the Excel row number under <see cref="ROW_KEY"/>. A missing named sheet gives no rows; a sheet without the
        /// required columns is a 400.
        /// </summary>
        public static List<Dictionary<string, string>> ReadSheet(
            ILoggerManager logger, string? fileName, byte[] content, string? sheetName, IReadOnlyList<string> requiredColumns)
        {
            List<List<string>> table;
            try
            {
                using MemoryStream stream = new MemoryStream(content);
                using XLWorkbook workbook = new XLWorkbook(stream);
                IXLWorksheet? sheet = sheetName == null
                    ? workbook.Worksheets.FirstOrDefault()
                    : workbook.Worksheets.FirstOrDefault(x => string.Equals(x.Name.Trim(), sheetName, StringComparison.OrdinalIgnoreCase));
                if (sheet == null)
                {
                    return new List<Dictionary<string, string>>();
                }

                table = ReadTable(sheet);
            }
            catch (Exception exception) when (exception is not BaseCustomException)
            {
                logger.LogError($"Excel workbook cannot be read. FileName: {fileName}, Error: {exception.GetType().Name}");
                throw new BadRequestCustomException("The Excel file cannot be read.", "Save the file as an .xlsx workbook made from the template.");
            }

            if (table.Count == 0)
            {
                return new List<Dictionary<string, string>>();
            }

            if (table.Count - 1 > MAX_ROWS)
            {
                logger.LogError($"Excel sheet has too many rows. FileName: {fileName}, Sheet: {sheetName}, Rows: {table.Count - 1}");
                throw new BadRequestCustomException("The file has too many rows.", $"Upload at most {MAX_ROWS} rows per sheet.");
            }

            List<string> names = table[0].Select(Normalize).ToList();
            List<string> missing = requiredColumns.Where(column => !names.Contains(Normalize(column))).ToList();
            if (missing.Count > 0)
            {
                logger.LogError($"Excel sheet misses columns. FileName: {fileName}, Sheet: {sheetName}, Missing: {string.Join(",", missing)}");
                throw new BadRequestCustomException(
                    "Columns are missing.",
                    $"Add the columns {string.Join(", ", missing)} to the first row of sheet {sheetName ?? "1"}, as in the template.");
            }

            List<Dictionary<string, string>> rows = new List<Dictionary<string, string>>();
            for (int index = 1; index < table.Count; index++)
            {
                List<string> cells = table[index];
                if (cells.All(string.IsNullOrWhiteSpace))
                {
                    continue;
                }

                Dictionary<string, string> row = new Dictionary<string, string> { [ROW_KEY] = (index + 1).ToString(CultureInfo.InvariantCulture) };
                for (int column = 0; column < names.Count && column < cells.Count; column++)
                {
                    if (names[column].Length > 0 && !row.ContainsKey(names[column]))
                    {
                        row[names[column]] = cells[column].Trim();
                    }
                }

                rows.Add(row);
            }

            return rows;
        }

        /// <summary>The trimmed value of a column, or null when it is empty or missing.</summary>
        public static string? Value(Dictionary<string, string> row, string column)
        {
            return row.TryGetValue(Normalize(column), out string? value) && !string.IsNullOrWhiteSpace(value) ? value.Trim() : null;
        }

        public static int RowNumber(Dictionary<string, string> row)
        {
            return int.Parse(row[ROW_KEY], CultureInfo.InvariantCulture);
        }

        /// <summary>A decimal written with a dot (or as an Excel number); null when empty or not a number.</summary>
        public static decimal? Number(string? text)
        {
            return decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out decimal value) ? value : null;
        }

        private static List<List<string>> ReadTable(IXLWorksheet sheet)
        {
            List<List<string>> table = new List<List<string>>();
            IXLRange? used = sheet.RangeUsed();
            if (used == null)
            {
                return table;
            }

            int columnCount = used.LastColumn().ColumnNumber();
            int lastRow = used.LastRow().RowNumber();
            for (int rowNumber = 1; rowNumber <= lastRow && rowNumber <= MAX_ROWS + 2; rowNumber++)
            {
                List<string> cells = new List<string>();
                for (int column = 1; column <= columnCount; column++)
                {
                    cells.Add(CellText(sheet.Cell(rowNumber, column).Value));
                }

                table.Add(cells);
            }

            return table;
        }

        private static string CellText(XLCellValue value)
        {
            if (value.IsDateTime)
            {
                return value.GetDateTime().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            }

            if (value.IsNumber)
            {
                return value.GetNumber().ToString(CultureInfo.InvariantCulture);
            }

            return value.IsBlank ? string.Empty : value.ToString(CultureInfo.InvariantCulture).Trim();
        }

        private static XLCellValue ToCellValue(object? value)
        {
            return value switch
            {
                null => Blank.Value,
                decimal number => number,
                int number => number,
                bool flag => flag ? "Y" : "N",
                DateTime date => date,
                _ => value.ToString() ?? string.Empty
            };
        }

        private static string Normalize(string column)
        {
            return new string((column ?? string.Empty).Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        }
    }
}
