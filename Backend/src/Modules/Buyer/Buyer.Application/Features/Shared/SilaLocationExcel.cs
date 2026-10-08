using ClosedXML.Excel;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The location Excel file: sheet "Locations", one row per location keyed by LocationCode. The property is given by
    /// its plant code, the parent venue and the outlet by their codes. TransferEnabled and SalesEnabled take Y or N.
    /// </summary>
    public static class SilaLocationExcel
    {
        public const string CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        public const string SHEET = "Locations";
        public const int MAX_ROWS = 2000;
        public const long MAX_FILE_BYTES = 5 * 1024 * 1024;

        public static readonly string[] Columns =
        {
            "LocationCode", "LocationName", "LocationType", "PropertyCode", "ParentVenueCode", "OutletCode", "StoreCategory",
            "StorageLocationCode", "GlAccount", "CostCenter", "ProfitCenter", "TransferEnabled", "SalesEnabled"
        };

        private static readonly string[] Required = { "LOCATIONCODE", "LOCATIONNAME", "LOCATIONTYPE", "PROPERTYCODE" };

        /// <summary>The template (headers only, no locations) or the export of the locations.</summary>
        public static byte[] Build(List<InventoryLocation> locations, SilaLocationContext context)
        {
            Dictionary<Guid, string> codes = context.Locations.ToDictionary(x => x.Id, x => x.LocationCode);
            Dictionary<Guid, string> outlets = context.Outlets.ToDictionary(x => x.Id, x => x.OutletCode ?? x.OutletName);
            using XLWorkbook workbook = new XLWorkbook();
            IXLWorksheet sheet = workbook.Worksheets.Add(SHEET);
            for (int index = 0; index < Columns.Length; index++)
            {
                sheet.Cell(1, index + 1).Value = Columns[index];
            }

            sheet.Row(1).Style.Font.Bold = true;
            sheet.SheetView.FreezeRows(1);
            int row = 2;
            foreach (InventoryLocation location in locations.OrderBy(x => x.LocationType == Common.SILA_LOCATION_VENUE ? 0 : 1).ThenBy(x => x.LocationCode))
            {
                string[] values =
                {
                    location.LocationCode,
                    location.LocationName,
                    location.LocationType,
                    context.Properties.TryGetValue(location.PropertyId, out BuyerProperty? property) ? property.PlantCode : string.Empty,
                    location.ParentLocationId != null && codes.TryGetValue(location.ParentLocationId.Value, out string? parent) ? parent : string.Empty,
                    location.OutletId != null && outlets.TryGetValue(location.OutletId.Value, out string? outlet) ? outlet : string.Empty,
                    location.StoreCategory ?? string.Empty,
                    location.StorageLocationCode ?? string.Empty,
                    location.GlAccount ?? string.Empty,
                    location.CostCenter ?? string.Empty,
                    location.ProfitCenter ?? string.Empty,
                    location.TransferEnabled ? "Y" : "N",
                    location.SalesEnabled ? "Y" : "N"
                };
                for (int index = 0; index < values.Length; index++)
                {
                    sheet.Cell(row, index + 1).SetValue(values[index]);
                }

                row++;
            }

            sheet.Columns().AdjustToContents();
            using MemoryStream stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        /// <summary>An .xlsx file is a zip archive: it starts with "PK\x03\x04".</summary>
        public static bool LooksLikeXlsx(byte[] content)
        {
            return SilaFileRules.HasSignature(SilaFileRules.KIND_XLSX, content);
        }

        /// <summary>
        /// The data rows of the Locations sheet as column name (upper case, letters and digits) → text, with their row
        /// numbers. Problems of the whole file go to fileErrors.
        /// </summary>
        public static List<(int RowNumber, Dictionary<string, string> Cells)> Read(byte[] content, List<string> fileErrors)
        {
            List<(int, Dictionary<string, string>)> rows = new List<(int, Dictionary<string, string>)>();
            XLWorkbook workbook;
            try
            {
                workbook = new XLWorkbook(new MemoryStream(content));
            }
            catch (Exception)
            {
                fileErrors.Add("The file could not be read as an Excel workbook. Save it as .xlsx and upload it again.");
                return rows;
            }

            using (workbook)
            {
                if (!workbook.TryGetWorksheet(SHEET, out IXLWorksheet? sheet))
                {
                    fileErrors.Add($"The file has no sheet named {SHEET}. Start from the downloaded template.");
                    return rows;
                }

                IXLRange? used = sheet.RangeUsed();
                if (used == null)
                {
                    fileErrors.Add("The Locations sheet is empty.");
                    return rows;
                }

                int lastColumn = used.LastColumn().ColumnNumber();
                int lastRow = used.LastRow().RowNumber();
                Dictionary<int, string> headers = new Dictionary<int, string>();
                for (int column = 1; column <= lastColumn; column++)
                {
                    string name = new string(sheet.Cell(1, column).GetString().Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
                    if (name.Length > 0 && !headers.ContainsValue(name))
                    {
                        headers[column] = name;
                    }
                }

                List<string> missing = Required.Where(x => !headers.ContainsValue(x)).ToList();
                if (missing.Count > 0)
                {
                    fileErrors.Add("The first row must name the columns LocationCode, LocationName, LocationType and PropertyCode. Start from the template.");
                    return rows;
                }

                if (lastRow - 1 > MAX_ROWS)
                {
                    fileErrors.Add($"The file has too many rows. Import at most {MAX_ROWS} locations at a time.");
                    return rows;
                }

                for (int rowNumber = 2; rowNumber <= lastRow; rowNumber++)
                {
                    Dictionary<string, string> cells = headers.ToDictionary(x => x.Value, x => sheet.Cell(rowNumber, x.Key).GetString().Trim());
                    if (cells.Values.All(string.IsNullOrWhiteSpace))
                    {
                        continue;
                    }

                    rows.Add((rowNumber, cells));
                }
            }

            return rows;
        }
    }
}
