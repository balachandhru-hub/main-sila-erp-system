using System.Globalization;
using System.Text.RegularExpressions;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Checks and writes ERP purchase orders (Excel import or GET_PO pull) into PurchaseOrder/PurchaseOrderItem with
    /// SourceType ERP. A purchase order is valid or invalid as a whole. Excel files follow the import rules (type, company
    /// code, supplier, currency, tax code, total amount and GR-expected flag required); ERP records need number, supplier
    /// and lines only, and an unknown supplier is added to the Supplier Master from the record.
    /// The supplier id of an ERP purchase order is the network supplier of the Supplier Master row when it is linked,
    /// otherwise the Supplier Master row id.
    /// </summary>
    public static partial class SilaPurchaseOrderSync
    {
        public const string SOURCE_ERP = "ERP";
        public const string STATUS_OPEN = "OPEN";

        private const decimal TOLERANCE = 0.0001m;
        private static readonly Regex CurrencyPattern = new Regex(@"^[A-Z]{3}$", RegexOptions.Compiled);
        private static readonly string[] DateFormats = { "yyyy-MM-dd", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-ddTHH:mm:ssZ", "dd/MM/yyyy", "dd.MM.yyyy", "yyyyMMdd" };

        /// <summary>One purchase order of the batch, checked; the lines are written only when it has no errors.</summary>
        public sealed class Plan
        {
            public string PoNumber { get; set; } = string.Empty;
            public List<int> RowNumbers { get; } = new();
            public List<string> Errors { get; } = new();
            public string Action { get; set; } = SilaReceivingExcel.ACTION_NEW;
            public PurchaseOrder? Existing { get; set; }
            public List<PurchaseOrderItem> ExistingItems { get; set; } = new();
            public SilaSupplier? Supplier { get; set; }
            public SilaSupplierWriteDto? NewSupplier { get; set; }
            public string? SupplierName { get; set; }
            public string? CompanyCode { get; set; }
            public string? Plant { get; set; }
            public string? Currency { get; set; }
            public decimal? TotalAmount { get; set; }
            public DateTime OrderDate { get; set; }
            public DateTime? DeliveryDate { get; set; }
            public List<Line> Lines { get; } = new();
        }

        public sealed class Line
        {
            public int RowNumber { get; set; }
            public int LineNumber { get; set; }
            public string? MaterialCode { get; set; }
            public string ProductName { get; set; } = string.Empty;
            public decimal Quantity { get; set; }
            public string? Uom { get; set; }
            public decimal? UnitPrice { get; set; }
            public decimal ReceivedQuantity { get; set; }
            /// <summary>Null when the source does not say (treated as expected).</summary>
            public bool? GoodsReceiptExpected { get; set; }
        }

        /// <summary>Checks the rows; returns the outcome per row and the purchase orders (valid or not).</summary>
        public static async Task<(List<SilaMasterImportRowDto> Rows, List<Plan> Plans)> CheckAsync(
            IRepositoryWrapper repository, Guid buyerId, List<SilaPoImportRowDto> rows, bool fromErp, CancellationToken cancellationToken)
        {
            Dictionary<int, List<string>> rowErrors = rows.ToDictionary(x => x.RowNumber, _ => new List<string>());
            foreach (SilaPoImportRowDto row in rows.Where(x => string.IsNullOrWhiteSpace(x.PoNumber)))
            {
                rowErrors[row.RowNumber].Add("PO number is required.");
            }

            List<IGrouping<string, SilaPoImportRowDto>> groups = rows
                .Where(x => !string.IsNullOrWhiteSpace(x.PoNumber))
                .GroupBy(x => x.PoNumber!.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToList();
            Lookups lookups = await LoadAsync(repository, buyerId, rows, groups.Select(x => x.Key).ToList(), cancellationToken);

            List<Plan> plans = new List<Plan>();
            foreach (IGrouping<string, SilaPoImportRowDto> group in groups)
            {
                plans.Add(CheckOne(group.Key, group.ToList(), rowErrors, lookups, fromErp));
            }

            List<SilaMasterImportRowDto> result = new List<SilaMasterImportRowDto>();
            Dictionary<int, Plan> planOfRow = plans.SelectMany(plan => plan.RowNumbers.Select(number => (number, plan))).ToDictionary(x => x.number, x => x.plan);
            foreach (SilaPoImportRowDto row in rows)
            {
                List<string> errors = rowErrors[row.RowNumber];
                Plan? plan = planOfRow.GetValueOrDefault(row.RowNumber);
                if (errors.Count == 0 && plan != null && plan.Errors.Count > 0)
                {
                    errors.AddRange(plan.Errors);
                }

                bool invalid = errors.Count > 0 || plan == null || plan.Errors.Count > 0 || plan.RowNumbers.Any(number => rowErrors[number].Count > 0);
                if (invalid && errors.Count == 0)
                {
                    errors.Add($"Purchase order {plan?.PoNumber} has an invalid line; it is not imported.");
                }

                result.Add(new SilaMasterImportRowDto
                {
                    RowNumber = row.RowNumber,
                    Key = $"{row.PoNumber?.Trim()}/{row.LineNumber?.Trim()}",
                    Action = invalid ? SilaReceivingExcel.ACTION_INVALID : plan!.Action,
                    Errors = errors
                });
            }

            foreach (Plan plan in plans.Where(plan => plan.RowNumbers.Any(number => rowErrors[number].Count > 0)))
            {
                plan.Errors.Add("The purchase order has invalid lines.");
            }

            return (result, plans);
        }

        private static Plan CheckOne(string poNumber, List<SilaPoImportRowDto> lines, Dictionary<int, List<string>> rowErrors, Lookups lookups, bool fromErp)
        {
            Plan plan = new Plan { PoNumber = poNumber };
            plan.RowNumbers.AddRange(lines.Select(x => x.RowNumber));
            SilaPoImportRowDto head = lines[0];
            foreach (SilaPoImportRowDto line in lines.Skip(1))
            {
                if (!Same(line.SupplierCode, head.SupplierCode) || !Same(line.CompanyCode, head.CompanyCode) || !Same(line.Currency, head.Currency)
                    || !Same(line.PoType, head.PoType) || !Same(line.TaxCode, head.TaxCode) || !Same(line.TotalAmount, head.TotalAmount) || !Same(line.OrderDate, head.OrderDate))
                {
                    rowErrors[line.RowNumber].Add($"Header fields differ from row {head.RowNumber} of the same purchase order.");
                }
            }

            List<string> errors = rowErrors[head.RowNumber];
            if (poNumber.Length > SilaInputRules.CODE_LENGTH)
            {
                errors.Add($"PO number can have at most {SilaInputRules.CODE_LENGTH} characters.");
            }

            if (!fromErp)
            {
                Require(errors, head.PoType, "PO type");
                Require(errors, head.CompanyCode, "Company code");
                Require(errors, head.Currency, "Currency");
                Require(errors, head.TaxCode, "Tax code");
                Require(errors, head.TotalAmount, "Total amount");
            }

            plan.CompanyCode = Upper(head.CompanyCode);
            if (plan.CompanyCode != null && !lookups.CompanyCodes.Contains(plan.CompanyCode))
            {
                errors.Add($"Company code {plan.CompanyCode} is not in the Company Code Master.");
            }

            plan.Currency = Upper(head.Currency);
            if (plan.Currency != null && !CurrencyPattern.IsMatch(plan.Currency))
            {
                errors.Add("Currency must be a 3 letter ISO code, for example AED.");
            }

            plan.TotalAmount = ParseDecimal(head.TotalAmount);
            if (head.TotalAmount != null && (plan.TotalAmount == null || plan.TotalAmount < 0))
            {
                errors.Add("Total amount must be a number of 0 or more.");
            }

            DateTime? orderDate = ParseDate(head.OrderDate);
            if (head.OrderDate != null && orderDate == null)
            {
                errors.Add("Order date must be a date (yyyy-MM-dd).");
            }

            plan.OrderDate = orderDate ?? DateTime.UtcNow.Date;
            plan.DeliveryDate = ParseDate(head.DeliveryDate);
            if (head.DeliveryDate != null && plan.DeliveryDate == null)
            {
                errors.Add("Delivery date must be a date (yyyy-MM-dd).");
            }
            plan.Plant = Upper(head.Plant);
            CheckSupplier(plan, head, errors, lookups, fromErp);
            CheckExisting(plan, errors, lookups);
            foreach (SilaPoImportRowDto line in lines)
            {
                Line? checkedLine = CheckLine(line, plan, rowErrors[line.RowNumber], lookups, fromErp);
                if (checkedLine != null)
                {
                    plan.Lines.Add(checkedLine);
                }
            }

            CheckLineChanges(plan, errors);
            return plan;
        }
    }
}
