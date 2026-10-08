using ClosedXML.Excel;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The material Excel file: sheet "Materials" (one row per material, keyed by MaterialCode) and sheet "Conversions"
    /// (MaterialCode, FromUom, Factor, ToUom). Description, BaseUom and ApprovedUnitPrice are for reading only; a value in
    /// NewUnitPrice requests a price change (approval), it never overwrites the approved price.
    /// </summary>
    public static class SilaMaterialExcel
    {
        public const string CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        public const string MATERIALS_SHEET = "Materials";
        public const string CONVERSIONS_SHEET = "Conversions";
        public const int MAX_ROWS = 5000;
        public const long MAX_FILE_BYTES = 5 * 1024 * 1024;

        public static readonly string[] MaterialColumns =
        {
            "MaterialCode", "Description", "BaseUom", "Barcode", "InventoryItem", "InventoryType", "BatchManaged", "ExpiryManaged",
            "ShelfLifeDays", "SerialManaged", "StandardPrice", "MovingAveragePrice", "ApprovedUnitPrice", "NewUnitPrice", "Currency",
            "PriceUom", "EffectiveFrom", "PriceReason"
        };

        public static readonly string[] ConversionColumns = { "MaterialCode", "FromUom", "Factor", "ToUom" };

        /// <summary>The template (headers only) or the export of the given materials and their conversions.</summary>
        public static byte[] Build(List<ItemBuyerMaster> materials, Dictionary<Guid, List<MaterialUomConversion>> conversions)
        {
            using XLWorkbook workbook = new XLWorkbook();
            IXLWorksheet sheet = workbook.Worksheets.Add(MATERIALS_SHEET);
            WriteHeader(sheet, MaterialColumns);
            int row = 2;
            foreach (ItemBuyerMaster material in materials)
            {
                sheet.Cell(row, 1).Value = material.MaterialCode ?? string.Empty;
                sheet.Cell(row, 2).Value = material.Description ?? string.Empty;
                sheet.Cell(row, 3).Value = UomConverter.BaseUomOf(material);
                sheet.Cell(row, 4).Value = material.Barcode ?? string.Empty;
                sheet.Cell(row, 5).Value = YesNo(material.IsInventoryItem);
                sheet.Cell(row, 6).Value = material.InventoryType ?? string.Empty;
                sheet.Cell(row, 7).Value = YesNo(material.BatchManaged);
                sheet.Cell(row, 8).Value = YesNo(material.ExpiryManaged);
                SetNumber(sheet.Cell(row, 9), material.ShelfLifeDays);
                sheet.Cell(row, 10).Value = YesNo(material.SerialManaged);
                SetNumber(sheet.Cell(row, 11), material.StandardPrice);
                SetNumber(sheet.Cell(row, 12), material.MovingAveragePrice);
                SetNumber(sheet.Cell(row, 13), material.UnitCost);
                sheet.Cell(row, 15).Value = material.Currency ?? string.Empty;
                row++;
            }

            IXLWorksheet conversionSheet = workbook.Worksheets.Add(CONVERSIONS_SHEET);
            WriteHeader(conversionSheet, ConversionColumns);
            int conversionRow = 2;
            foreach (ItemBuyerMaster material in materials)
            {
                if (!conversions.TryGetValue(material.Id, out List<MaterialUomConversion>? list))
                {
                    continue;
                }

                foreach (MaterialUomConversion conversion in list.OrderBy(x => x.FromUom))
                {
                    conversionSheet.Cell(conversionRow, 1).Value = material.MaterialCode ?? string.Empty;
                    conversionSheet.Cell(conversionRow, 2).Value = conversion.FromUom;
                    conversionSheet.Cell(conversionRow, 3).Value = conversion.Factor;
                    conversionSheet.Cell(conversionRow, 4).Value = conversion.ToUom;
                    conversionRow++;
                }
            }

            sheet.Columns().AdjustToContents();
            conversionSheet.Columns().AdjustToContents();
            using MemoryStream stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        /// <summary>An .xlsx file is a zip archive: it starts with "PK\x03\x04".</summary>
        public static bool LooksLikeXlsx(byte[] content)
        {
            return SilaFileRules.HasSignature(SilaFileRules.KIND_XLSX, content);
        }

        private static void WriteHeader(IXLWorksheet sheet, string[] columns)
        {
            for (int index = 0; index < columns.Length; index++)
            {
                sheet.Cell(1, index + 1).Value = columns[index];
            }

            sheet.Row(1).Style.Font.Bold = true;
            sheet.SheetView.FreezeRows(1);
        }

        private static string YesNo(bool value)
        {
            return value ? "Y" : "N";
        }

        private static void SetNumber(IXLCell cell, decimal? value)
        {
            if (value != null)
            {
                cell.Value = value.Value;
            }
        }

        private static void SetNumber(IXLCell cell, int? value)
        {
            if (value != null)
            {
                cell.Value = value.Value;
            }
        }
    }
}
