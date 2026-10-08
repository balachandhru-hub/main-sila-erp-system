using System.Globalization;
using ClosedXML.Excel;
using Buyer.Domain.Dtos;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Reads the material Excel file into rows. Cell problems (a bad number, Y/N or date) are kept on the row; problems of
    /// the whole file (no Materials sheet, no MaterialCode column, too many rows) go to <c>fileErrors</c>.
    /// </summary>
    public static class SilaMaterialExcelReader
    {
        public static void Read(
            XLWorkbook workbook,
            List<string> fileErrors,
            List<SilaMaterialExcelRow> materials,
            List<SilaConversionExcelRow> conversions)
        {
            if (!workbook.TryGetWorksheet(SilaMaterialExcel.MATERIALS_SHEET, out IXLWorksheet? sheet))
            {
                fileErrors.Add($"The file has no sheet named {SilaMaterialExcel.MATERIALS_SHEET}. Start from the downloaded template.");
                return;
            }

            List<List<string>> table = ReadTable(sheet);
            Dictionary<string, int> columns = table.Count == 0 ? new Dictionary<string, int>() : Columns(table[0]);
            if (!columns.ContainsKey("MATERIALCODE"))
            {
                fileErrors.Add("The first row of the Materials sheet must name the columns, starting with MaterialCode.");
                return;
            }

            for (int index = 1; index < table.Count; index++)
            {
                List<string> cells = table[index];
                if (cells.All(string.IsNullOrWhiteSpace))
                {
                    continue;
                }

                SilaMaterialExcelRow row = new SilaMaterialExcelRow { RowNumber = index + 1 };
                row.MaterialCode = Cell(cells, columns, "MATERIALCODE").ToUpperInvariant();
                if (row.MaterialCode.Length == 0)
                {
                    row.Errors.Add("MaterialCode is required.");
                }

                row.Fields = new SilaMaterialInventoryWriteDto
                {
                    Barcode = Text(cells, columns, "BARCODE"),
                    IsInventoryItem = Flag(cells, columns, "INVENTORYITEM", row.Errors),
                    InventoryType = Text(cells, columns, "INVENTORYTYPE")?.ToUpperInvariant(),
                    BatchManaged = Flag(cells, columns, "BATCHMANAGED", row.Errors),
                    ExpiryManaged = Flag(cells, columns, "EXPIRYMANAGED", row.Errors),
                    ShelfLifeDays = Whole(Number(cells, columns, "SHELFLIFEDAYS", row.Errors), "SHELFLIFEDAYS", row.Errors),
                    SerialManaged = Flag(cells, columns, "SERIALMANAGED", row.Errors),
                    StandardPrice = Number(cells, columns, "STANDARDPRICE", row.Errors),
                    MovingAveragePrice = Number(cells, columns, "MOVINGAVERAGEPRICE", row.Errors)
                };
                row.NewUnitPrice = Number(cells, columns, "NEWUNITPRICE", row.Errors);
                row.Currency = Text(cells, columns, "CURRENCY")?.ToUpperInvariant();
                row.PriceUom = Text(cells, columns, "PRICEUOM")?.ToUpperInvariant();
                row.PriceReason = Text(cells, columns, "PRICEREASON");
                row.EffectiveFrom = Date(cells, columns, "EFFECTIVEFROM", row.Errors);
                materials.Add(row);
            }

            if (workbook.TryGetWorksheet(SilaMaterialExcel.CONVERSIONS_SHEET, out IXLWorksheet? conversionSheet))
            {
                ReadConversions(ReadTable(conversionSheet), fileErrors, conversions);
            }

            if (materials.Count + conversions.Count > SilaMaterialExcel.MAX_ROWS)
            {
                fileErrors.Add($"The file has too many rows. Import at most {SilaMaterialExcel.MAX_ROWS} rows at a time.");
            }
        }

        private static void ReadConversions(List<List<string>> table, List<string> fileErrors, List<SilaConversionExcelRow> conversions)
        {
            if (table.Count == 0)
            {
                return;
            }

            Dictionary<string, int> columns = Columns(table[0]);
            if (!columns.ContainsKey("MATERIALCODE") || !columns.ContainsKey("FROMUOM") || !columns.ContainsKey("FACTOR") || !columns.ContainsKey("TOUOM"))
            {
                fileErrors.Add("The Conversions sheet must have the columns MaterialCode, FromUom, Factor and ToUom.");
                return;
            }

            for (int index = 1; index < table.Count; index++)
            {
                List<string> cells = table[index];
                if (cells.All(string.IsNullOrWhiteSpace))
                {
                    continue;
                }

                SilaConversionExcelRow row = new SilaConversionExcelRow
                {
                    RowNumber = index + 1,
                    MaterialCode = Cell(cells, columns, "MATERIALCODE").ToUpperInvariant(),
                    FromUom = Cell(cells, columns, "FROMUOM").ToUpperInvariant(),
                    ToUom = Cell(cells, columns, "TOUOM").ToUpperInvariant()
                };
                row.Factor = Number(cells, columns, "FACTOR", row.Errors) ?? 0;
                conversions.Add(row);
            }
        }

        private static List<List<string>> ReadTable(IXLWorksheet sheet)
        {
            List<List<string>> table = new List<List<string>>();
            IXLRange? used = sheet.RangeUsed();
            if (used == null)
            {
                return table;
            }

            int lastColumn = used.LastColumn().ColumnNumber();
            int lastRow = Math.Min(used.LastRow().RowNumber(), SilaMaterialExcel.MAX_ROWS + 2);
            for (int rowNumber = 1; rowNumber <= lastRow; rowNumber++)
            {
                List<string> cells = new List<string>();
                for (int column = 1; column <= lastColumn; column++)
                {
                    cells.Add(CellText(sheet.Cell(rowNumber, column).Value));
                }

                table.Add(cells);
            }

            return table;
        }

        private static Dictionary<string, int> Columns(List<string> header)
        {
            Dictionary<string, int> columns = new Dictionary<string, int>();
            for (int index = 0; index < header.Count; index++)
            {
                string name = new string(header[index].Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
                if (name.Length > 0 && !columns.ContainsKey(name))
                {
                    columns[name] = index;
                }
            }

            return columns;
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

        private static string Cell(List<string> cells, Dictionary<string, int> columns, string name)
        {
            return columns.TryGetValue(name, out int index) && index < cells.Count ? cells[index].Trim() : string.Empty;
        }

        private static string? Text(List<string> cells, Dictionary<string, int> columns, string name)
        {
            string value = Cell(cells, columns, name);
            return value.Length == 0 ? null : value;
        }

        private static bool Flag(List<string> cells, Dictionary<string, int> columns, string name, List<string> errors)
        {
            string value = Cell(cells, columns, name).ToUpperInvariant();
            if (value is "Y" or "YES" or "TRUE" or "1")
            {
                return true;
            }

            if (value is "" or "N" or "NO" or "FALSE" or "0")
            {
                return false;
            }

            errors.Add($"{name} must be Y or N.");
            return false;
        }

        private static decimal? Number(List<string> cells, Dictionary<string, int> columns, string name, List<string> errors)
        {
            string value = Cell(cells, columns, name);
            if (value.Length == 0)
            {
                return null;
            }

            if (decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out decimal number))
            {
                return number;
            }

            errors.Add($"{name} must be a number.");
            return null;
        }

        private static int? Whole(decimal? value, string name, List<string> errors)
        {
            if (value == null)
            {
                return null;
            }

            if (value != decimal.Truncate(value.Value) || value < int.MinValue || value > int.MaxValue)
            {
                errors.Add($"{name} must be a whole number.");
                return null;
            }

            return (int)value.Value;
        }

        private static DateTime? Date(List<string> cells, Dictionary<string, int> columns, string name, List<string> errors)
        {
            string value = Cell(cells, columns, name);
            if (value.Length == 0)
            {
                return null;
            }

            if (DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime date))
            {
                return date;
            }

            errors.Add($"{name} must be a date (yyyy-MM-dd).");
            return null;
        }
    }
}
