using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Input checks shared by the SILA ME endpoints: text lengths, quantity and price ranges, allowed values, dates and paging.
    /// Every failed check is a 400 with a message that tells the user what to change.
    /// </summary>
    public static class SilaInputRules
    {
        public const int CODE_LENGTH = 40;
        public const int NAME_LENGTH = 200;
        public const int COMMENT_LENGTH = 500;
        public const int DESCRIPTION_LENGTH = 1000;
        public const decimal MAX_QUANTITY = 1_000_000_000m;
        public const int DEFAULT_LIMIT = 50;
        public const int MAX_LIMIT = 200;

        /// <summary>The page size: default when not positive, never above the maximum.</summary>
        public static int Limit(int limit, int defaultLimit = DEFAULT_LIMIT)
        {
            return limit <= 0 ? defaultLimit : Math.Min(limit, MAX_LIMIT);
        }

        /// <summary>The 0-based row offset; a negative value is treated as 0.</summary>
        public static int Index(int index)
        {
            return Math.Max(0, index);
        }

        /// <summary>Throws when the text is longer than the maximum.</summary>
        public static void MaxLength(ILoggerManager logger, string? value, int maxLength, string field)
        {
            if (value != null && value.Trim().Length > maxLength)
            {
                logger.LogError($"Input too long. Field: {field}, Length: {value.Trim().Length}, Max: {maxLength}");
                throw new BadRequestCustomException($"{field} is too long.", $"Enter at most {maxLength} characters for {field}.");
            }
        }

        /// <summary>Throws when the text is empty or longer than the maximum.</summary>
        public static void Required(ILoggerManager logger, string? value, int maxLength, string field)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                logger.LogError($"Required input missing. Field: {field}");
                throw new BadRequestCustomException($"{field} is required.", $"Enter {field}.");
            }

            MaxLength(logger, value, maxLength, field);
        }

        /// <summary>Throws unless 0 &lt; quantity ≤ 1e9.</summary>
        public static void PositiveQuantity(ILoggerManager logger, decimal quantity, string field)
        {
            if (quantity <= 0 || quantity > MAX_QUANTITY)
            {
                logger.LogError($"Quantity out of range. Field: {field}, Value: {quantity}");
                throw new BadRequestCustomException(
                    $"{field} must be greater than zero.",
                    $"Enter a {field} greater than 0 and at most 1,000,000,000.");
            }
        }

        /// <summary>Throws unless 0 ≤ quantity ≤ 1e9 (zero allowed, e.g. a counted or rejected quantity).</summary>
        public static void NonNegativeQuantity(ILoggerManager logger, decimal quantity, string field)
        {
            if (quantity < 0 || quantity > MAX_QUANTITY)
            {
                logger.LogError($"Quantity out of range. Field: {field}, Value: {quantity}");
                throw new BadRequestCustomException(
                    $"{field} cannot be negative.",
                    $"Enter a {field} between 0 and 1,000,000,000.");
            }
        }

        /// <summary>Throws unless the price is empty or 0 ≤ price ≤ 1e9.</summary>
        public static void Price(ILoggerManager logger, decimal? price, string field)
        {
            if (price != null && (price < 0 || price > MAX_QUANTITY))
            {
                logger.LogError($"Price out of range. Field: {field}, Value: {price}");
                throw new BadRequestCustomException($"{field} cannot be negative.", $"Enter a {field} between 0 and 1,000,000,000.");
            }
        }

        /// <summary>The value upper-cased when it is one of the allowed values; otherwise a 400 that lists them.</summary>
        public static string OneOf(ILoggerManager logger, string? value, IEnumerable<string> allowed, string field)
        {
            string normalized = (value ?? string.Empty).Trim().ToUpperInvariant();
            List<string> values = allowed.ToList();
            if (!values.Contains(normalized))
            {
                logger.LogError($"Unknown value. Field: {field}, Value: {value}");
                throw new BadRequestCustomException($"Unknown {field}.", $"Use one of: {string.Join(", ", values)}.");
            }

            return normalized;
        }

        /// <summary>Throws when the date is outside the given number of years around today.</summary>
        public static void SaneDate(ILoggerManager logger, DateTime? date, string field, int yearsBack = 5, int yearsAhead = 2)
        {
            if (date == null)
            {
                return;
            }

            DateTime today = DateTime.UtcNow.Date;
            if (date.Value < today.AddYears(-yearsBack) || date.Value > today.AddYears(yearsAhead))
            {
                logger.LogError($"Date out of range. Field: {field}, Value: {date:yyyy-MM-dd}");
                throw new BadRequestCustomException(
                    $"{field} is out of range.",
                    $"Enter a {field} between {today.AddYears(-yearsBack):yyyy-MM-dd} and {today.AddYears(yearsAhead):yyyy-MM-dd}.");
            }
        }

        /// <summary>Throws when the list is empty or longer than the maximum.</summary>
        public static void Lines<T>(ILoggerManager logger, ICollection<T>? lines, int maxLines, string what)
        {
            if (lines == null || lines.Count == 0)
            {
                logger.LogError($"No lines sent. What: {what}");
                throw new BadRequestCustomException($"Add at least one {what}.", $"The request needs one or more {what} lines.");
            }

            if (lines.Count > maxLines)
            {
                logger.LogError($"Too many lines sent. What: {what}, Count: {lines.Count}, Max: {maxLines}");
                throw new BadRequestCustomException($"Too many {what} lines.", $"Send at most {maxLines} {what} lines at a time.");
            }
        }
    }
}
