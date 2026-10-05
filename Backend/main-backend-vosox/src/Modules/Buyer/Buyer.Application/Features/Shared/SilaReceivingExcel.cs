using System.Globalization;
using Buyer.Domain.Dtos;
using ClosedXML.Excel;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Excel files of the SILA ME receiving masters (suppliers, company codes, purchase orders): templates, exports and
    /// the reading of uploaded workbooks. Imports read the first sheet; the first row names the columns.
    /// </summary>
    public static class SilaReceivingExcel
    {
        public const string CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        /// <summary>Largest workbook accepted, in bytes (5 MB).</summary>
        public const long MAX_BYTES = 5L * 1024 * 1024;

        /// <summary>Most data rows read from one workbook.</summary>
        public const int MAX_ROWS = 5000;

        /// <summary>Rows returned in a preview.</summary>
        public const int PREVIEW_ROWS = 200;

        public const string ACTION_NEW = "NEW";
        public const string ACTION_UPDATE = "UPDATE";
        public const string ACTION_UNCHANGED = "UNCHANGED";
        public const string ACTION_INVALID = "INVALID";

        /// <summary>A workbook with one sheet: bold header row, then the rows.</summary>
        public static SilaReceivingFileDto Build(string sheetName, string fileName, IReadOnlyList<string> headers, IEnumerable<IReadOnlyList<object?>> rows)
        {
            using XLWorkbook workbook = new XLWorkbook();
            IXLWorksheet sheet = workbook.Worksheets.Add(sheetName);
            for (int column = 0; column < headers.Count; column++)
            {
                sheet.Cell(1, column + 1).Value = headers[column];
                sheet.Cell(1, column + 1).Style.Font.Bold = true;
            }

            int rowNumber = 1;
            foreach (IReadOnlyList<object?> row in rows)
            {
                rowNumber++;
                for (int column = 0; column < row.Count && column < headers.Count; column++)
                {
                    sheet.Cell(rowNumber, column + 1).Value = ToCellValue(row[column]);
                }
            }

            sheet.Columns().AdjustToContents();
            using MemoryStream stream = new MemoryStream();
            workbook.SaveAs(stream);
            return new SilaReceivingFileDto
            {
                Content = stream.ToArray(),
                ContentType = CONTENT_TYPE,
                FileName = fileName
            };
        }

        /// <summary>
        /// The data rows of an uploaded .xlsx, each as column name (letters and digits, upper case) to text, with the
        /// Excel row number under "#ROW". Refuses a file that is not a workbook, too large, without rows or without the
        /// required columns.
        /// </summary>
        public static List<Dictionary<string, string>> Read(ILoggerManager logger, string? fileName, byte[] content, IReadOnlyList<string> requiredColumns)
        {
            SilaFileRules.Validate(logger, "Excel import", fileName, content, new[] { SilaFileRules.KIND_XLSX }, MAX_BYTES);

            List<List<string>> table = ReadTable(logger, fileName, content);
            if (table.Count < 2)
            {
                logger.LogError($"Excel file has no rows. FileName: {fileName}");
                throw new BadRequestCustomException("The file has no rows.", "Keep the column names in the first row and add one record per row below it.");
            }

            if (table.Count - 1 > MAX_ROWS)
            {
                logger.LogError($"Excel file has too many rows. FileName: {fileName}, Rows: {table.Count - 1}");
                throw new BadRequestCustomException("The file has too many rows.", $"Upload at most {MAX_ROWS} rows per file.");
            }

            List<string> names = table[0].Select(Normalize).ToList();
            List<string> missing = requiredColumns.Where(column => !names.Contains(Normalize(column))).ToList();
            if (missing.Count > 0)
            {
                logger.LogError($"Excel file misses columns. FileName: {fileName}, Missing: {string.Join(",", missing)}");
                throw new BadRequestCustomException("Columns are missing.", $"Add the columns {string.Join(", ", missing)} to the first row, as in the template.");
            }

            List<Dictionary<string, string>> rows = new List<Dictionary<string, string>>();
            for (int index = 1; index < table.Count; index++)
            {
                List<string> cells = table[index];
                if (cells.All(string.IsNullOrWhiteSpace))
                {
                    continue;
                }

                Dictionary<string, string> row = new Dictionary<string, string> { ["#ROW"] = (index + 1).ToString(CultureInfo.InvariantCulture) };
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
            return int.Parse(row["#ROW"], CultureInfo.InvariantCulture);
        }

        /// <summary>The preview list: invalid rows first, then by row number, at most <see cref="PREVIEW_ROWS"/>.</summary>
        public static List<SilaMasterImportRowDto> PreviewRows(IEnumerable<SilaMasterImportRowDto> rows)
        {
            return rows
                .OrderBy(x => x.Action == ACTION_INVALID ? 0 : 1)
                .ThenBy(x => x.RowNumber)
                .Take(PREVIEW_ROWS)
                .ToList();
        }

        /// <summary>The counts of a checked file and its preview rows.</summary>
        public static SilaMasterImportResultDto Summarize(string? fileName, List<SilaMasterImportRowDto> rows)
        {
            return new SilaMasterImportResultDto
            {
                FileName = fileName ?? string.Empty,
                TotalRows = rows.Count,
                ValidRows = rows.Count(x => x.Action != ACTION_INVALID),
                InvalidRows = rows.Count(x => x.Action == ACTION_INVALID),
                NewRows = rows.Count(x => x.Action == ACTION_NEW),
                UpdateRows = rows.Count(x => x.Action == ACTION_UPDATE),
                UnchangedRows = rows.Count(x => x.Action == ACTION_UNCHANGED),
                Rows = PreviewRows(rows)
            };
        }

        /// <summary>Why an import was refused: the first invalid rows and their errors.</summary>
        public static string RefusalMessage(List<SilaMasterImportRowDto> rows)
        {
            List<string> problems = rows
                .Where(x => x.Action == ACTION_INVALID)
                .OrderBy(x => x.RowNumber)
                .Take(5)
                .Select(x => $"Row {x.RowNumber}: {string.Join(" ", x.Errors)}")
                .ToList();
            return $"No records were changed. Correct the file and upload it again. {string.Join(" ", problems)}";
        }

        private static string Normalize(string column)
        {
            return new string((column ?? string.Empty).Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        }

        private static XLCellValue ToCellValue(object? value)
        {
            return value switch
            {
                null => Blank.Value,
                string text => text,
                decimal number => number,
                int number => number,
                bool flag => flag ? "TRUE" : "FALSE",
                DateTime date => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                _ => value.ToString() ?? string.Empty
            };
        }

        private static List<List<string>> ReadTable(ILoggerManager logger, string? fileName, byte[] content)
        {
            try
            {
                using MemoryStream stream = new MemoryStream(content);
                using XLWorkbook workbook = new XLWorkbook(stream);
                IXLWorksheet sheet = workbook.Worksheet(1);
                IXLRange? used = sheet.RangeUsed();
                List<List<string>> table = new List<List<string>>();
                if (used == null)
                {
                    return table;
                }

                int columnCount = used.LastColumn().ColumnNumber();
                foreach (IXLRangeRow row in used.Rows())
                {
                    List<string> cells = new List<string>();
                    for (int column = 1; column <= columnCount; column++)
                    {
                        cells.Add(CellText(row.Cell(column).Value));
                    }

                    table.Add(cells);
                }

                return table;
            }
            catch (Exception exception) when (exception is not BaseCustomException)
            {
                logger.LogError($"Excel workbook cannot be read. FileName: {fileName}, Error: {SilaLogText.Short(exception.Message)}");
                throw new BadRequestCustomException("The Excel file cannot be read.", "Save the file as an .xlsx workbook with the records on the first sheet.");
            }
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
    }
}
