using System.Globalization;
using System.Text;
using Buyer.Domain.Dtos;
using ClosedXML.Excel;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Reading and writing of the POS Excel/CSV files (sales upload, outlet and item mapping imports, templates).
    /// The content is checked against its extension (xlsx = zip signature, csv = text without NUL bytes).
    /// </summary>
    public static class SilaPosFiles
    {
        public const long MAX_FILE_BYTES = 10 * 1024 * 1024;

        public const string XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        /// <summary>Rows of the first sheet (xlsx) or of the file (csv) as text; the first row is the header.</summary>
        public static List<List<string>> ReadTable(byte[] content, string? fileName, ILoggerManager logger, bool allowCsv)
        {
            string[] allowedKinds = allowCsv
                ? new[] { SilaFileRules.KIND_XLSX, SilaFileRules.KIND_CSV }
                : new[] { SilaFileRules.KIND_XLSX };
            string kind = SilaFileRules.Validate(logger, "POS file", fileName, content, allowedKinds, MAX_FILE_BYTES);
            return kind == SilaFileRules.KIND_CSV ? ReadCsv(content) : ReadXlsx(content, fileName, logger);
        }

        /// <summary>Column positions by normalised header name (letters and digits, upper case).</summary>
        public static Dictionary<string, int> HeaderMap(List<string> header)
        {
            Dictionary<string, int> columns = new Dictionary<string, int>();
            for (int index = 0; index < header.Count; index++)
            {
                string name = Normalize(header[index]);
                if (name.Length > 0 && !columns.ContainsKey(name))
                {
                    columns[name] = index;
                }
            }

            return columns;
        }

        /// <summary>The cell of the first of the column names present in the header (aliases), or null.</summary>
        public static string? Cell(List<string> cells, Dictionary<string, int> columns, params string[] names)
        {
            foreach (string name in names)
            {
                if (columns.TryGetValue(name, out int index))
                {
                    return index < cells.Count ? cells[index] : null;
                }
            }

            return null;
        }

        /// <summary>A workbook with one sheet: bold header row and optional example rows.</summary>
        public static SilaPosFileDto BuildTemplate(string fileName, string sheetName, string[] header, List<string[]> examples)
        {
            using XLWorkbook workbook = new XLWorkbook();
            IXLWorksheet sheet = workbook.Worksheets.Add(sheetName);
            for (int column = 0; column < header.Length; column++)
            {
                sheet.Cell(1, column + 1).Value = header[column];
                sheet.Cell(1, column + 1).Style.Font.Bold = true;
                // Text cells keep codes such as 0012 as typed.
                sheet.Column(column + 1).Style.NumberFormat.Format = "@";
            }

            for (int row = 0; row < examples.Count; row++)
            {
                for (int column = 0; column < examples[row].Length && column < header.Length; column++)
                {
                    sheet.Cell(row + 2, column + 1).Value = examples[row][column];
                }
            }

            sheet.Columns().AdjustToContents();
            using MemoryStream stream = new MemoryStream();
            workbook.SaveAs(stream);
            return new SilaPosFileDto { Content = stream.ToArray(), ContentType = XLSX_CONTENT_TYPE, FileName = fileName };
        }

        public static string Normalize(string value)
        {
            return new string(value.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        }

        private static List<List<string>> ReadXlsx(byte[] content, string? fileName, ILoggerManager logger)
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
                logger.LogError($"POS workbook cannot be read. FileName: {fileName}, Error: {SilaLogText.Short(exception.Message)}");
                throw new BadRequestCustomException("The Excel file cannot be read.", "Save the file as a .xlsx workbook with the data on the first sheet.");
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

        /// <summary>RFC 4180 CSV: comma or semicolon separated, quoted fields may hold separators, quotes and line breaks.</summary>
        private static List<List<string>> ReadCsv(byte[] content)
        {
            string text = Encoding.UTF8.GetString(content).TrimStart('﻿');
            int firstLineEnd = text.IndexOfAny(new[] { '\r', '\n' });
            string header = firstLineEnd < 0 ? text : text.Substring(0, firstLineEnd);
            char separator = header.Count(x => x == ';') > header.Count(x => x == ',') ? ';' : ',';

            List<List<string>> table = new List<List<string>>();
            List<string> row = new List<string>();
            StringBuilder field = new StringBuilder();
            bool quoted = false;
            for (int index = 0; index < text.Length; index++)
            {
                char current = text[index];
                if (quoted)
                {
                    if (current == '"' && index + 1 < text.Length && text[index + 1] == '"')
                    {
                        field.Append('"');
                        index++;
                    }
                    else if (current == '"')
                    {
                        quoted = false;
                    }
                    else
                    {
                        field.Append(current);
                    }
                }
                else if (current == '"')
                {
                    quoted = true;
                }
                else if (current == separator)
                {
                    row.Add(field.ToString().Trim());
                    field.Clear();
                }
                else if (current == '\r' || current == '\n')
                {
                    if (current == '\r' && index + 1 < text.Length && text[index + 1] == '\n')
                    {
                        index++;
                    }

                    row.Add(field.ToString().Trim());
                    field.Clear();
                    table.Add(row);
                    row = new List<string>();
                }
                else
                {
                    field.Append(current);
                }
            }

            if (field.Length > 0 || row.Count > 0)
            {
                row.Add(field.ToString().Trim());
                table.Add(row);
            }

            return table;
        }
    }
}
