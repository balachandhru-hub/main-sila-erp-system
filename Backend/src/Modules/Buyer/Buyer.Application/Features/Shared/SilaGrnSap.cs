using System.Globalization;
using System.Text.Json;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// PROTECTED / FROZEN: GRN SAP 101 posting mapper and GRN SAP 102 reversal mapper.
    /// 101 uses FIVE S4-GRN POSTING only. 102 uses FIVE S4-GRN REVERSAL only.
    /// Do not invent sample/fallback SAP values. Do not change the frozen 101 field contract.
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

            string compact = CompactName(name);
            return compact is "FIVES4GRNPOSTING" or "FIVES4POSTGRN";
        }

        private static string CompactName(string name)
        {
            return name.Trim()
                .Replace(" ", string.Empty, StringComparison.Ordinal)
                .Replace("-", string.Empty, StringComparison.Ordinal)
                .Replace("_", string.Empty, StringComparison.Ordinal)
                .ToUpperInvariant();
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

        public const string POSTING_MISMATCH = "GRN_REQUEST_MAPPING_MISMATCH";
        public const string POSTING_MISSING = "GRN_REQUIRED_FIELD_MISSING";
        public const string REVERSAL_MISMATCH = "GRN_REVERSAL_REQUEST_MAPPING_MISMATCH";

        public static string FieldMismatch(string code, string field, string? prepared, string? outbound)
        {
            return code + ". Field " + field + ". Prepared Value: " + Display(prepared) + ". Outbound Value: " + Display(outbound) + ".";
        }

        public static string FieldMissing(string code, string field)
        {
            return code + ". Field " + field + " is missing on the prepared document.";
        }

        public static string? CompareField(string code, string field, string? prepared, string? outbound, bool ignoreCase = false)
        {
            if (string.IsNullOrWhiteSpace(prepared))
            {
                return FieldMissing(code == REVERSAL_MISMATCH ? "GRN_REVERSAL_REQUIRED_FIELD_MISSING" : POSTING_MISSING, field);
            }

            if (string.IsNullOrWhiteSpace(outbound))
            {
                return FieldMismatch(code, field, prepared, outbound);
            }

            StringComparison comparison = ignoreCase ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
            if (!string.Equals(prepared.Trim(), outbound.Trim(), comparison))
            {
                return FieldMismatch(code, field, prepared, outbound);
            }

            return null;
        }

        /// <summary>Outbound 102 body must match original GRN material/PO/plant/SLoc/UOM and confirmed reversal qty.</summary>
        public static string? ValidateReversalBody(string body, IReadOnlyList<SilaGrnReversalSapLine> expected, bool isFullRemainingReversal)
        {
            using JsonDocument json = JsonDocument.Parse(body);
            JsonElement root = json.RootElement;
            string expectedHeader = isFullRemainingReversal ? REVERSAL_HEADER_TEXT_FULL : REVERSAL_HEADER_TEXT_PARTIAL;
            if (root.TryGetProperty("DocumentHeaderText", out _))
            {
                return FieldMismatch(REVERSAL_MISMATCH, "DocumentHeaderText", "(not used; API_MATERIAL_DOCUMENT_SRV field is MaterialDocumentHeaderText)", root.GetProperty("DocumentHeaderText").ToString());
            }

            string? header = root.TryGetProperty("MaterialDocumentHeaderText", out JsonElement headerEl) ? headerEl.GetString() : null;
            string? code = root.TryGetProperty("GoodsMovementCode", out JsonElement codeEl) ? codeEl.GetString() : null;
            string? mismatch = CompareField(REVERSAL_MISMATCH, "MaterialDocumentHeaderText", expectedHeader, header)
                ?? CompareField(REVERSAL_MISMATCH, "GoodsMovementCode", GOODS_MOVEMENT_CODE, code);
            if (mismatch != null)
            {
                return mismatch;
            }

            if (!root.TryGetProperty("to_MaterialDocumentItem", out JsonElement lines) || lines.ValueKind != JsonValueKind.Array)
            {
                return FieldMissing(REVERSAL_MISMATCH, "to_MaterialDocumentItem");
            }

            if (lines.GetArrayLength() != expected.Count)
            {
                return FieldMismatch(REVERSAL_MISMATCH, "to_MaterialDocumentItem.Count", expected.Count.ToString(CultureInfo.InvariantCulture), lines.GetArrayLength().ToString(CultureInfo.InvariantCulture));
            }

            int index = 0;
            foreach (JsonElement line in lines.EnumerateArray())
            {
                SilaGrnReversalSapLine prepared = expected[index];
                string? Read(string name) => line.TryGetProperty(name, out JsonElement value) ? value.ToString() : null;
                mismatch = CompareField(REVERSAL_MISMATCH, "Material", prepared.Material, Read("Material"))
                    ?? CompareField(REVERSAL_MISMATCH, "Plant", prepared.Plant, Read("Plant"))
                    ?? (string.IsNullOrWhiteSpace(prepared.StorageLocation)
                        ? null
                        : CompareField(REVERSAL_MISMATCH, "StorageLocation", prepared.StorageLocation, Read("StorageLocation")))
                    ?? CompareField(REVERSAL_MISMATCH, "GoodsMovementType", REVERSAL_GOODS_MOVEMENT_TYPE, Read("GoodsMovementType"))
                    ?? CompareField(REVERSAL_MISMATCH, "GoodsMovementRefDocType", GOODS_MOVEMENT_REF_DOC_TYPE, Read("GoodsMovementRefDocType"))
                    ?? CompareField(REVERSAL_MISMATCH, "EntryUnit", prepared.EntryUnit, Read("EntryUnit"), ignoreCase: true)
                    ?? CompareField(REVERSAL_MISMATCH, "PurchaseOrder", prepared.PurchaseOrder, Read("PurchaseOrder"))
                    ?? CompareField(REVERSAL_MISMATCH, "PurchaseOrderItem", prepared.PurchaseOrderItem, Read("PurchaseOrderItem"))
                    ?? CompareField(REVERSAL_MISMATCH, "QuantityInEntryUnit", FormatQuantity(prepared.Quantity), Read("QuantityInEntryUnit"));
                if (mismatch != null)
                {
                    return mismatch;
                }

                index++;
            }

            return null;
        }

        private static string Display(string? value) => string.IsNullOrWhiteSpace(value) ? "(empty)" : value.Trim();

        /// <summary>
        /// Approved FIVE S4-GRN REVERSAL body: MaterialDocumentHeaderText, GoodsMovementType 102, positive QuantityInEntryUnit.
        /// DocumentHeaderText is rejected by API_MATERIAL_DOCUMENT_SRV (same header field as 101).
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
                    ["GoodsMovementRefDocType"] = GOODS_MOVEMENT_REF_DOC_TYPE,
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
                ["MaterialDocumentHeaderText"] = headerText,
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

        /// <summary>Plant/SLoc/UOM/PO item from the original successful 101 request stored on this GRN. No rematch.</summary>
        public static List<SilaGrnPostedSapLine> ReadPostedGrnItems(string? requestBody)
        {
            List<SilaGrnPostedSapLine> rows = new List<SilaGrnPostedSapLine>();
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
                    string Read(string name) => item.TryGetProperty(name, out JsonElement value) ? value.ToString().Trim() : string.Empty;
                    string material = Read("Material");
                    string plant = Read("Plant");
                    string poItem = Read("PurchaseOrderItem");
                    if (string.IsNullOrWhiteSpace(material) || string.IsNullOrWhiteSpace(plant) || string.IsNullOrWhiteSpace(poItem))
                    {
                        continue;
                    }

                    rows.Add(new SilaGrnPostedSapLine
                    {
                        Material = material,
                        Plant = plant,
                        StorageLocation = string.IsNullOrWhiteSpace(Read("StorageLocation")) ? null : Read("StorageLocation"),
                        EntryUnit = Read("EntryUnit"),
                        PurchaseOrder = Read("PurchaseOrder"),
                        PurchaseOrderItem = poItem
                    });
                }
            }
            catch (JsonException)
            {
                // Caller fails closed when nothing is read.
            }

            return rows;
        }

        public static SilaGrnPostedSapLine? FindPostedLine(IReadOnlyList<SilaGrnPostedSapLine> posted, string material, string purchaseOrderItem)
        {
            return posted.FirstOrDefault(x =>
                string.Equals(x.Material, material, StringComparison.Ordinal)
                && string.Equals(x.PurchaseOrderItem, purchaseOrderItem, StringComparison.Ordinal));
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

    public sealed class SilaGrnPostedSapLine
    {
        public string Material { get; init; } = string.Empty;
        public string Plant { get; init; } = string.Empty;
        public string? StorageLocation { get; init; }
        public string EntryUnit { get; init; } = string.Empty;
        public string PurchaseOrder { get; init; } = string.Empty;
        public string PurchaseOrderItem { get; init; } = string.Empty;
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
