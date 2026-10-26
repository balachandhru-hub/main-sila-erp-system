using SharedKernel.ExceptionHandler;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Log text of SILA ME code: external messages (ERP, POS, OCR, integration) are shortened so that no response body,
    /// file content or long payload ends up in the logs; line breaks are flattened to keep one log entry per line.
    /// </summary>
    public static class SilaLogText
    {
        public const int MAX_EXTERNAL_MESSAGE = 300;

        public static string Short(string? text, int maxLength = MAX_EXTERNAL_MESSAGE)
        {
            if (string.IsNullOrEmpty(text))
            {
                return string.Empty;
            }

            string flat = text.Replace('\r', ' ').Replace('\n', ' ');
            return flat.Length <= maxLength ? flat : flat.Substring(0, maxLength) + "...";
        }

        /// <summary>
        /// User-visible failure text: message, custom description, and inner exceptions. Never an empty string.
        /// </summary>
        public static string FromException(Exception? exception, int maxLength = MAX_EXTERNAL_MESSAGE)
        {
            if (exception == null)
            {
                return "Unknown error.";
            }

            List<string> parts = new List<string>();
            for (Exception? current = exception; current != null; current = current.InnerException)
            {
                Add(parts, current.Message);
                if (current is BaseCustomException custom)
                {
                    Add(parts, custom.Description);
                }
            }

            string text = parts.Count == 0 ? exception.GetType().Name : string.Join(" — ", parts);
            return Short(text, maxLength);
        }

        private static void Add(List<string> parts, string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return;
            }

            string trimmed = value.Trim();
            if (!parts.Exists(x => string.Equals(x, trimmed, StringComparison.OrdinalIgnoreCase)))
            {
                parts.Add(trimmed);
            }
        }
    }
}
