using System.Text.RegularExpressions;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Prepares an ERP request or response body for storage and display: values of credential-like fields (password,
    /// secret, token, api key, authorization, client secret) are masked in JSON, form and XML bodies, and the text is
    /// truncated to 4000 characters.
    /// </summary>
    public static class SilaErpPayload
    {
        public const int MAX_LENGTH = 4000;
        private const string MASK = "***";
        private const string SECRET_KEYS = "password|passwd|pwd|secret|client_?secret|token|access_?token|refresh_?token|api_?key|apikey|authorization|credential[s]?";

        private static readonly Regex JsonSecret = new Regex(
            @"(""(?:" + SECRET_KEYS + @")""\s*:\s*)(""(?:[^""\\]|\\.)*""|[^,}\]\s]+)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled, TimeSpan.FromSeconds(1));

        private static readonly Regex FormSecret = new Regex(
            @"((?:^|[?&])(?:" + SECRET_KEYS + @")=)[^&\s]*",
            RegexOptions.IgnoreCase | RegexOptions.Compiled, TimeSpan.FromSeconds(1));

        private static readonly Regex XmlSecret = new Regex(
            @"(<(" + SECRET_KEYS + @")>)[^<]*(</\2>)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled, TimeSpan.FromSeconds(1));

        public static string? Sanitise(string? body)
        {
            if (string.IsNullOrEmpty(body))
            {
                return null;
            }

            string text = body.Length > MAX_LENGTH * 4 ? body[..(MAX_LENGTH * 4)] : body;
            try
            {
                text = JsonSecret.Replace(text, "$1\"" + MASK + "\"");
                text = FormSecret.Replace(text, "$1" + MASK);
                text = XmlSecret.Replace(text, "$1" + MASK + "$3");
            }
            catch (RegexMatchTimeoutException)
            {
                return "[payload not shown: it could not be checked for credentials]";
            }

            return text.Length > MAX_LENGTH ? text[..MAX_LENGTH] : text;
        }
    }
}
