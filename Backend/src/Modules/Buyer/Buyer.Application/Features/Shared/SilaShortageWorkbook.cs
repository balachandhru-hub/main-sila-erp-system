using ClosedXML.Excel;
using Buyer.Domain.Dtos;

namespace Buyer.Application.Features.Shared
{
    /// <summary>The shortage report as an Excel workbook: summary, by location, by reason and every line.</summary>
    public static class SilaShortageWorkbook
    {
        private const string DATE_FORMAT = "yyyy-mm-dd";
        private const string NUMBER_FORMAT = "#,##0.####";
        private const string MONEY_FORMAT = "#,##0.00";

        public static byte[] Build(SilaShortageReportDto report, string? locationName, string? category, string? enquiryStatus)
        {
            using XLWorkbook workbook = new XLWorkbook();
            AddSummary(workbook, report, locationName, category, enquiryStatus);
            AddGroups(workbook, "By location", "Location", report.ByLocation);
            AddGroups(workbook, "By reason", "Justification", report.ByReason);
            AddLines(workbook, report.Lines);
            using MemoryStream stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        private static void AddSummary(XLWorkbook workbook, SilaShortageReportDto report, string? locationName, string? category, string? enquiryStatus)
        {
            IXLWorksheet sheet = workbook.Worksheets.Add("Summary");
            sheet.Cell(1, 1).Value = "Shortage report";
            sheet.Cell(1, 1).Style.Font.Bold = true;
            sheet.Cell(1, 1).Style.Font.FontSize = 14;
            object[][] rows =
            {
                new object[] { "From", report.From },
                new object[] { "To", report.To },
                new object[] { "Location", locationName ?? "All" },
                new object[] { "Justification", category ?? "All" },
                new object[] { "Enquiry status", enquiryStatus ?? "All" },
                new object[] { string.Empty, string.Empty },
                new object[] { "Shortage lines", report.Totals.Lines },
                new object[] { "Shortage value", report.Totals.ShortageValue },
                new object[] { "Justified lines", report.Totals.JustifiedLines },
                new object[] { "Justified value", report.Totals.JustifiedValue },
                new object[] { "Accepted lines", report.Totals.AcceptedLines },
                new object[] { "Accepted value", report.Totals.AcceptedValue },
                new object[] { "Rejected lines", report.Totals.RejectedLines },
                new object[] { "Rejected value", report.Totals.RejectedValue },
                new object[] { "Posted lines", report.Totals.PostedLines },
                new object[] { "Posted value", report.Totals.PostedValue }
            };
            for (int i = 0; i < rows.Length; i++)
            {
                IXLCell label = sheet.Cell(i + 3, 1);
                IXLCell value = sheet.Cell(i + 3, 2);
                label.Value = (string)rows[i][0];
                label.Style.Font.Bold = true;
                SetValue(value, rows[i][1]);
            }

            sheet.Columns().AdjustToContents();
        }

        private static void AddGroups(XLWorkbook workbook, string name, string keyHeader, List<SilaShortageGroupDto> groups)
        {
            IXLWorksheet sheet = workbook.Worksheets.Add(name);
            Header(sheet, keyHeader, "Lines", "Shortage qty", "Shortage value", "Posted value");
            int row = 2;
            foreach (SilaShortageGroupDto group in groups)
            {
                sheet.Cell(row, 1).Value = group.Name;
                sheet.Cell(row, 2).Value = group.Lines;
                Number(sheet.Cell(row, 3), group.ShortageQty, NUMBER_FORMAT);
                Number(sheet.Cell(row, 4), group.ShortageValue, MONEY_FORMAT);
                Number(sheet.Cell(row, 5), group.PostedValue, MONEY_FORMAT);
                row++;
            }

            sheet.Columns().AdjustToContents();
        }

        private static void AddLines(XLWorkbook workbook, List<SilaShortageLineDto> lines)
        {
            IXLWorksheet sheet = workbook.Worksheets.Add("Lines");
            Header(sheet, "Count", "Type", "Count status", "Location", "Submitted", "Material code", "Material", "UOM", "System qty",
                "Counted qty", "Shortage qty", "Unit cost", "Shortage value", "Enquiry", "Enquiry status", "Justification", "Response",
                "Review", "Review comment", "Posted");
            int row = 2;
            foreach (SilaShortageLineDto line in lines)
            {
                sheet.Cell(row, 1).Value = line.CountNumber;
                sheet.Cell(row, 2).Value = line.CountType;
                sheet.Cell(row, 3).Value = line.CountStatus;
                sheet.Cell(row, 4).Value = line.LocationName ?? string.Empty;
                if (line.SubmittedOn != null)
                {
                    sheet.Cell(row, 5).Value = line.SubmittedOn.Value;
                    sheet.Cell(row, 5).Style.DateFormat.Format = DATE_FORMAT;
                }

                sheet.Cell(row, 6).Value = line.MaterialCode;
                sheet.Cell(row, 7).Value = line.MaterialName;
                sheet.Cell(row, 8).Value = line.Uom;
                Number(sheet.Cell(row, 9), line.SystemQty, NUMBER_FORMAT);
                if (line.CountedQty != null)
                {
                    Number(sheet.Cell(row, 10), line.CountedQty.Value, NUMBER_FORMAT);
                }

                Number(sheet.Cell(row, 11), line.ShortageQty, NUMBER_FORMAT);
                if (line.UnitCost != null)
                {
                    Number(sheet.Cell(row, 12), line.UnitCost.Value, MONEY_FORMAT);
                }

                Number(sheet.Cell(row, 13), line.ShortageValue, MONEY_FORMAT);
                sheet.Cell(row, 14).Value = line.EnquiryNumber ?? string.Empty;
                sheet.Cell(row, 15).Value = line.EnquiryStatus ?? string.Empty;
                sheet.Cell(row, 16).Value = line.JustificationCategory ?? string.Empty;
                sheet.Cell(row, 17).Value = line.Response ?? string.Empty;
                sheet.Cell(row, 18).Value = line.ReviewStatus ?? string.Empty;
                sheet.Cell(row, 19).Value = line.ReviewComment ?? string.Empty;
                sheet.Cell(row, 20).Value = line.Posted ? "Yes" : "No";
                row++;
            }

            sheet.SheetView.FreezeRows(1);
            sheet.Columns().AdjustToContents(1, Math.Min(row, 500));
        }

        private static void Header(IXLWorksheet sheet, params string[] titles)
        {
            for (int i = 0; i < titles.Length; i++)
            {
                IXLCell cell = sheet.Cell(1, i + 1);
                cell.Value = titles[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.LightGray;
            }
        }

        private static void Number(IXLCell cell, decimal value, string format)
        {
            cell.Value = value;
            cell.Style.NumberFormat.Format = format;
        }

        private static void SetValue(IXLCell cell, object value)
        {
            switch (value)
            {
                case DateTime date:
                    cell.Value = date;
                    cell.Style.DateFormat.Format = DATE_FORMAT;
                    break;
                case int number:
                    cell.Value = number;
                    break;
                case decimal amount:
                    Number(cell, amount, MONEY_FORMAT);
                    break;
                default:
                    cell.Value = value.ToString() ?? string.Empty;
                    break;
            }
        }
    }
}
