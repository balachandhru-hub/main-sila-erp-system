using System.Text.Json;

namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// Reads the document number (purchase order, sales order ...) an external ERP returns in the body of its answer.
    /// </summary>
    public static class ExternalDocumentNumber
    {
        private static readonly string[] CandidateNames =
        {
            "purchaseOrderNumber",
            "poNumber",
            "documentNumber",
            "salesOrderNumber",
            "salesOrderId",
            "orderNumber",
            "orderNo",
            "prNumber",
            "purchaseRequisitionNumber",
            "jdeOrderNumber",
            "number"
        };

        /// <summary>The first of the known number fields, at the top of the answer or in an object inside it. Null when there is none.</summary>
        public static string? TryRead(string? body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return null;
            }

            try
            {
                using JsonDocument document = JsonDocument.Parse(body);
                return ReadElement(document.RootElement);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static string? ReadElement(JsonElement element)
        {
            if (element.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            foreach (string name in CandidateNames)
            {
                if (element.TryGetProperty(name, out JsonElement value) && value.ValueKind == JsonValueKind.String)
                {
                    string? text = value.GetString();
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        return text;
                    }
                }
            }

            foreach (JsonProperty property in element.EnumerateObject())
            {
                if (property.Value.ValueKind == JsonValueKind.Object)
                {
                    string? nested = ReadElement(property.Value);
                    if (!string.IsNullOrWhiteSpace(nested))
                    {
                        return nested;
                    }
                }
            }

            return null;
        }
    }
}
