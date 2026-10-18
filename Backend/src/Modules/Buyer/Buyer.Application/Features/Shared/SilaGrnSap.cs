using System.Globalization;
using System.Text.Json;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// SAP S/4 goods receipt posted through the POST_GRN configuration named FIVE S4-GRN POSTING
    /// (API_MATERIAL_DOCUMENT_SRV / A_MaterialDocumentHeader). Shape matches the previous SILAME
    /// S4HanaPostGrnAdapter: GoodsMovementCode 01, movement type 101.
    /// Reversal uses the same service's Cancel function import (SAP posts movement type 102).
    /// </summary>
    public static class SilaGrnSap
    {
        /// <summary>Canonical integration name (same style as FIVE S4-INVOICE POSTING).</summary>
        public const string API_CONFIG_NAME = "FIVE S4-GRN POSTING";

        /// <summary>Earlier seed name kept as an alias so existing ACTIVE rows still use the SAP body.</summary>
        public const string API_CONFIG_NAME_LEGACY = "FIVE S4 - POST GRN";

        public const string GOODS_MOVEMENT_CODE = "01";
        public const string GOODS_MOVEMENT_TYPE = "101";
        /// <summary>SAP posts this when Cancel is called on a 101 goods receipt. Do not post Z02.</summary>
        public const string REVERSAL_GOODS_MOVEMENT_TYPE = "102";
        public const string GOODS_MOVEMENT_REF_DOC_TYPE = "B";

        /// <summary>OData function import on API_MATERIAL_DOCUMENT_SRV — cancels the original Material Document.</summary>
        public const string CANCEL_RESOURCE_PATH = "sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/Cancel";

        public static bool IsConfiguredName(string? name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return false;
            }

            string text = name.Trim();
            return text.Equals(API_CONFIG_NAME, StringComparison.OrdinalIgnoreCase)
                || text.Equals(API_CONFIG_NAME_LEGACY, StringComparison.OrdinalIgnoreCase);
        }

        public static string CancelResourcePathFrom(string? createResourcePath)
        {
            if (string.IsNullOrWhiteSpace(createResourcePath))
            {
                return CANCEL_RESOURCE_PATH;
            }

            string path = createResourcePath.Trim().TrimEnd('/');
            int idx = path.IndexOf("API_MATERIAL_DOCUMENT_SRV", StringComparison.OrdinalIgnoreCase);
            if (idx < 0)
            {
                return CANCEL_RESOURCE_PATH;
            }

            return path[..idx] + "API_MATERIAL_DOCUMENT_SRV/Cancel";
        }

        /// <summary>Cancel function-import body for the original Material Document (full document cancel → SAP 102).</summary>
        public static string CancelBody(string materialDocument, string materialDocumentYear, DateTime postingDateUtc)
        {
            long ms = new DateTimeOffset(DateTime.SpecifyKind(postingDateUtc.Date, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
            return JsonSerializer.Serialize(new Dictionary<string, string>
            {
                ["MaterialDocument"] = materialDocument.Trim(),
                ["MaterialDocumentYear"] = materialDocumentYear.Trim(),
                ["PostingDate"] = $"/Date({ms})/"
            });
        }

        public static (string? Document, string? Year) ReadMaterialDocument(string? responseBody, string? erpReference)
        {
            string? document = string.IsNullOrWhiteSpace(erpReference) ? null : erpReference.Trim();
            string? year = null;
            if (!string.IsNullOrWhiteSpace(responseBody))
            {
                try
                {
                    using JsonDocument json = JsonDocument.Parse(responseBody);
                    JsonElement root = json.RootElement;
                    if (root.TryGetProperty("d", out JsonElement d))
                    {
                        root = d;
                    }

                    if (root.TryGetProperty("MaterialDocument", out JsonElement md))
                    {
                        document = md.GetString()?.Trim() ?? document;
                    }

                    if (root.TryGetProperty("MaterialDocumentYear", out JsonElement y))
                    {
                        year = y.GetString()?.Trim();
                    }
                }
                catch (JsonException)
                {
                    // Keep erpReference fallback.
                }
            }

            if (string.IsNullOrWhiteSpace(year) && !string.IsNullOrWhiteSpace(document))
            {
                year = DateTime.UtcNow.Year.ToString(CultureInfo.InvariantCulture);
            }

            return (document, year);
        }
    }
}
