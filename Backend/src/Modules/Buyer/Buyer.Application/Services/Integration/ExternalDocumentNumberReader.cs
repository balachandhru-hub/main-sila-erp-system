using System.Text.Json;

namespace Buyer.Application.Services.Integration
{
    public static class ExternalDocumentNumberReader
    {
        private static readonly string[] CandidateNames =
        {
            "purchaseOrderNumber",
            "poNumber",
            "documentNumber",
            "prNumber",
            "purchaseRequisitionNumber",
            "orderNumber",
            "orderNo",
            "jdeOrderNumber",
            "salesOrderNumber",
            "number",
            "key",
            "PurchaseOrder"
        };

        // The id an ERP answers with when it creates a contract. A string or a number, at the top or one object down.
        private static readonly string[] ContractReferenceNames =
        {
            "erpContractId",
            "contractId",
            "contractNumber",
            "contractNo",
            "documentNumber",
            "key",
            "id",
            "number",
            "reference"
        };

        public static string? TryReadContractReference(string? body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return null;
            }

            try
            {
                using JsonDocument document = JsonDocument.Parse(body);
                JsonElement root = document.RootElement;
                if (root.ValueKind == JsonValueKind.String || root.ValueKind == JsonValueKind.Number)
                {
                    return ReferenceText(root);
                }

                return ReadReference(root, 0);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static string? ReadReference(JsonElement element, int depth)
        {
            if (element.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            foreach (string name in ContractReferenceNames)
            {
                if (element.TryGetProperty(name, out JsonElement value))
                {
                    string? text = ReferenceText(value);
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        return text;
                    }
                }
            }

            if (depth < 1)
            {
                foreach (JsonProperty property in element.EnumerateObject())
                {
                    string? nested = ReadReference(property.Value, depth + 1);
                    if (!string.IsNullOrWhiteSpace(nested))
                    {
                        return nested;
                    }
                }
            }

            return null;
        }

        private static string? ReferenceText(JsonElement value)
        {
            return value.ValueKind switch
            {
                JsonValueKind.String => value.GetString(),
                JsonValueKind.Number => value.GetRawText(),
                _ => null
            };
        }

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
            if (element.ValueKind == JsonValueKind.Object)
            {
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
            }

            return null;
        }

        public static string? TryReadToken(string? body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return null;
            }

            try
            {
                using JsonDocument document = JsonDocument.Parse(body);
                JsonElement root = document.RootElement;
                string[] names = { "access_token", "accessToken", "token", "jwt", "id_token" };
                foreach (string name in names)
                {
                    if (root.TryGetProperty(name, out JsonElement value) && value.ValueKind == JsonValueKind.String)
                    {
                        string? text = value.GetString();
                        if (!string.IsNullOrWhiteSpace(text))
                        {
                            return text;
                        }
                    }
                }
            }
            catch (JsonException)
            {
                return null;
            }

            return null;
        }
    }
}
