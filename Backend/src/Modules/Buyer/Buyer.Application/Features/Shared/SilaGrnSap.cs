using System.Globalization;
using System.Text.Json;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// SAP S/4 goods receipt posted through the POST_GRN configuration named FIVE S4-GRN POSTING
    /// (API_MATERIAL_DOCUMENT_SRV / A_MaterialDocumentHeader). Shape matches the previous SILAME
    /// S4HanaPostGrnAdapter: GoodsMovementCode 01, movement type 101.
    /// Reversal uses a separate configuration FIVE S4-GRN REVERSAL (POST_GRN_REVERSAL) posting
    /// movement type 102 with the confirmed reversal quantity (full or partial).
    /// </summary>
    public static class SilaGrnSap
    {
        /// <summary>Canonical integration name (same style as FIVE S4-INVOICE POSTING).</summary>
        public const string API_CONFIG_NAME = "FIVE S4-GRN POSTING";

        /// <summary>Earlier seed name kept as an alias so existing ACTIVE rows still use the SAP body.</summary>
        public const string API_CONFIG_NAME_LEGACY = "FIVE S4 - POST GRN";

        /// <summary>Dedicated GRN reversal integration (102). Never reuse FIVE S4-GRN POSTING.</summary>
        public const string REVERSAL_API_CONFIG_NAME = "FIVE S4-GRN REVERSAL";

        public const string GOODS_MOVEMENT_CODE = "01";
        public const string GOODS_MOVEMENT_TYPE = "101";
        /// <summary>Movement type for GRN reversal material-document POST.</summary>
        public const string REVERSAL_GOODS_MOVEMENT_TYPE = "102";
        public const string GOODS_MOVEMENT_REF_DOC_TYPE = "B";
        public const string REVERSAL_REFERENCE_DOCUMENT = "GRN-REVERSAL";
        public const string REVERSAL_HEADER_TEXT_FULL = "GRN Reversal";
        public const string REVERSAL_HEADER_TEXT_PARTIAL = "GRN Partial Reversal";

        /// <summary>OData Cancel path kept for audit/legacy reference only — reversal posting must not use Cancel for partial qty.</summary>
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

        public static bool IsReversalConfiguredName(string? name)
        {
            return !string.IsNullOrWhiteSpace(name)
                && name.Trim().Equals(REVERSAL_API_CONFIG_NAME, StringComparison.OrdinalIgnoreCase);
        }

        public static string FormatQuantity(decimal quantity)
        {
            if (quantity <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(quantity), "QuantityInEntryUnit must be positive.");
            }

            return quantity.ToString("0.################", CultureInfo.InvariantCulture);
        }

        public static string FormatSapDate(DateTime date)
        {
            return DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified)
                .ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture);
        }

        public static string FormatPurchaseOrderItem(int lineNumber)
        {
            return lineNumber.ToString("00000", CultureInfo.InvariantCulture);
        }

        /// <summary>
        /// Approved FIVE S4-GRN REVERSAL body: GoodsMovementType 102, positive QuantityInEntryUnit.
        /// </summary>
        public static string ReversalBody(
            DateTime postingDate,
            DateTime documentDate,
            bool isFullRemainingReversal,
            string? referenceDocument,
            IReadOnlyList<SilaGrnReversalSapLine> lines)
        {
            if (lines == null || lines.Count == 0)
            {
                throw new ArgumentException("At least one reversal line is required.", nameof(lines));
            }

            string headerText = isFullRemainingReversal ? REVERSAL_HEADER_TEXT_FULL : REVERSAL_HEADER_TEXT_PARTIAL;
            string reference = string.IsNullOrWhiteSpace(referenceDocument)
                ? REVERSAL_REFERENCE_DOCUMENT
                : referenceDocument.Trim();

            var items = lines.Select(line =>
            {
                Dictionary<string, object?> item = new Dictionary<string, object?>
                {
                    ["Material"] = line.Material.Trim(),
                    ["Plant"] = line.Plant.Trim(),
                    ["GoodsMovementType"] = REVERSAL_GOODS_MOVEMENT_TYPE,
                    ["QuantityInEntryUnit"] = FormatQuantity(line.Quantity),
                    ["EntryUnit"] = line.EntryUnit.Trim(),
                    ["PurchaseOrder"] = line.PurchaseOrder.Trim(),
                    ["PurchaseOrderItem"] = line.PurchaseOrderItem.Trim()
                };
                if (!string.IsNullOrWhiteSpace(line.StorageLocation))
                {
                    item["StorageLocation"] = line.StorageLocation.Trim();
                }

                return item;
            }).ToList();

            return JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["PostingDate"] = FormatSapDate(postingDate),
                ["DocumentDate"] = FormatSapDate(documentDate),
                ["GoodsMovementCode"] = GOODS_MOVEMENT_CODE,
                ["DocumentHeaderText"] = headerText,
                ["ReferenceDocument"] = reference,
                ["to_MaterialDocumentItem"] = items
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

        /// <summary>Parse confirmed reversal quantities from a stored FIVE S4-GRN REVERSAL request body (local finalization retry).</summary>
        public static List<(string Material, string PurchaseOrderItem, decimal Quantity)> ReadReversalQuantities(string? requestBody)
        {
            List<(string, string, decimal)> rows = new List<(string, string, decimal)>();
            if (string.IsNullOrWhiteSpace(requestBody))
            {
                return rows;
            }

            try
            {
                using JsonDocument json = JsonDocument.Parse(requestBody);
                if (!json.RootElement.TryGetProperty("to_MaterialDocumentItem", out JsonElement items)
                    || items.ValueKind != JsonValueKind.Array)
                {
                    return rows;
                }

                foreach (JsonElement item in items.EnumerateArray())
                {
                    string material = item.TryGetProperty("Material", out JsonElement m) ? m.GetString()?.Trim() ?? string.Empty : string.Empty;
                    string poItem = item.TryGetProperty("PurchaseOrderItem", out JsonElement p) ? p.GetString()?.Trim() ?? string.Empty : string.Empty;
                    string? qtyText = item.TryGetProperty("QuantityInEntryUnit", out JsonElement q) ? q.GetString() : null;
                    if (string.IsNullOrWhiteSpace(material)
                        || string.IsNullOrWhiteSpace(poItem)
                        || !decimal.TryParse(qtyText, NumberStyles.Number, CultureInfo.InvariantCulture, out decimal qty)
                        || qty <= 0)
                    {
                        continue;
                    }

                    rows.Add((material, poItem, qty));
                }
            }
            catch (JsonException)
            {
                // Empty — caller validates.
            }

            return rows;
        }
    }

    public sealed class SilaGrnReversalSapLine
    {
        public string Material { get; init; } = string.Empty;
        public string Plant { get; init; } = string.Empty;
        public string? StorageLocation { get; init; }
        public decimal Quantity { get; init; }
        public string EntryUnit { get; init; } = string.Empty;
        public string PurchaseOrder { get; init; } = string.Empty;
        public string PurchaseOrderItem { get; init; } = string.Empty;
    }
}
