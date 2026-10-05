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
    }
}
