using System.Globalization;
using Buyer.Domain.Dtos;

namespace Buyer.Application.Features.Shared
{
    /// <summary>The raw text values of one sold line (file cells or API fields) before validation.</summary>
    public class SilaPosRawRow
    {
        public int RowNumber { get; set; }
        public string? BusinessDate { get; set; }
        public string? TransactionId { get; set; }
        public string? LineId { get; set; }
        public string? PosCode { get; set; }
        public string? Quantity { get; set; }
        public string? Uom { get; set; }
        public string? OutletCode { get; set; }
        public string? Currency { get; set; }
        public string? Amount { get; set; }
    }

    /// <summary>Validation of one sold line read from a sales file or the POS sales API.</summary>
    public static class SilaPosRows
    {
        public const int MAX_ROW_ERRORS = 200;

        private const int MAX_CODE_LENGTH = 100;

        private static readonly string[] DATE_FORMATS =
        {
            "yyyy-MM-dd", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyyMMdd",
            "dd/MM/yyyy", "dd-MM-yyyy", "dd.MM.yyyy", "dd/MM/yyyy HH:mm:ss", "d/M/yyyy"
        };

        /// <summary>
        /// Reads one sold line. An invalid line returns null and its problems in <paramref name="message"/>;
        /// it is added to the errors while they hold fewer than <see cref="MAX_ROW_ERRORS"/>.
        /// </summary>
        public static SilaPosSaleRowDto? Read(SilaPosRawRow raw, List<SilaPosRowErrorDto> errors, out string? message)
        {
            List<string> problems = new List<string>();
            DateTime? date = ParseDate(raw.BusinessDate);
            if (date == null)
            {
                problems.Add("BusinessDate is missing or not a date (use yyyy-MM-dd)");
            }

            if (string.IsNullOrWhiteSpace(raw.TransactionId))
            {
                problems.Add("TransactionId is missing");
            }
            else if (raw.TransactionId.Trim().Length > MAX_CODE_LENGTH)
            {
                problems.Add($"TransactionId is longer than {MAX_CODE_LENGTH} characters");
            }

            int line = 1;
            if (!string.IsNullOrWhiteSpace(raw.LineId) && (!int.TryParse(raw.LineId.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out line) || line < 1))
            {
                problems.Add("LineId must be a whole number from 1");
            }

            if (string.IsNullOrWhiteSpace(raw.PosCode))
            {
                problems.Add("PosCode is missing");
            }
            else if (raw.PosCode.Trim().Length > MAX_CODE_LENGTH)
            {
                problems.Add($"PosCode is longer than {MAX_CODE_LENGTH} characters");
            }

            decimal? sold = ParseDecimal(raw.Quantity);
            if (sold == null || sold <= 0)
            {
                problems.Add("Qty must be a number greater than zero");
            }

            if (string.IsNullOrWhiteSpace(raw.OutletCode))
            {
                problems.Add("OutletCode is missing");
            }
            else if (raw.OutletCode.Trim().Length > MAX_CODE_LENGTH)
            {
                problems.Add($"OutletCode is longer than {MAX_CODE_LENGTH} characters");
            }

            decimal? value = ParseDecimal(raw.Amount);
            if (!string.IsNullOrWhiteSpace(raw.Amount) && value == null)
            {
                problems.Add("Amount is not a number");
            }

            string? uom = string.IsNullOrWhiteSpace(raw.Uom) ? null : raw.Uom.Trim().ToUpperInvariant();
            if (uom != null && uom.Length > 20)
            {
                problems.Add("UOM is longer than 20 characters");
            }

            string? currency = string.IsNullOrWhiteSpace(raw.Currency) ? null : raw.Currency.Trim().ToUpperInvariant();
            if (currency != null && (currency.Length != 3 || !currency.All(char.IsLetter)))
            {
                problems.Add("Currency must be a 3-letter code such as AED");
            }

            if (problems.Count > 0)
            {
                message = string.Join("; ", problems) + ".";
                if (errors.Count < MAX_ROW_ERRORS)
                {
                    errors.Add(new SilaPosRowErrorDto { Row = raw.RowNumber, Message = message });
                }

                return null;
            }

            message = null;
            return new SilaPosSaleRowDto
            {
                RowNumber = raw.RowNumber,
                BusinessDate = date!.Value.Date,
                TransactionId = raw.TransactionId!.Trim(),
                LineId = line,
                PosCode = raw.PosCode!.Trim(),
                Quantity = sold!.Value,
                OutletCode = raw.OutletCode!.Trim(),
                Amount = value,
                Uom = uom,
                Currency = currency
            };
        }

        public static DateTime? ParseDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            string text = value.Trim();
            if (DateTime.TryParseExact(text, DATE_FORMATS, CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime exact))
            {
                return exact;
            }

            // Excel serial dates and ISO timestamps with a zone.
            if (double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out double serial) && serial > 20000 && serial < 80000)
            {
                return DateTime.FromOADate(serial);
            }

            return DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out DateTime parsed) ? parsed : null;
        }

        public static decimal? ParseDecimal(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return decimal.TryParse(value.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out decimal parsed) ? parsed : null;
        }
    }
}
