using System.Text.Json;
using System.Text.Json.Serialization;

namespace SharedKernel.Integration.Enums
{
    /// <summary>
    /// Maps stored/API protocol names onto IntegrationProtocol without rewriting the database.
    /// Unknown historical aliases are accepted on read; canonical names are written on save.
    /// </summary>
    public static class IntegrationProtocolMap
    {
        public static string ToStored(IntegrationProtocol protocol) => protocol.ToString();

        public static bool TryParse(string? value, out IntegrationProtocol protocol)
        {
            protocol = IntegrationProtocol.REST;
            if (string.IsNullOrWhiteSpace(value))
            {
                return false;
            }

            string key = Compact(value);
            switch (key)
            {
                case "REST":
                case "RESTAPI":
                    protocol = IntegrationProtocol.REST;
                    return true;
                case "ODATAV2":
                case "ODATA2":
                    protocol = IntegrationProtocol.ODATA_V2;
                    return true;
                case "ODATAV4":
                case "ODATA4":
                case "ODATA":
                    protocol = IntegrationProtocol.ODATA_V4;
                    return true;
                case "SOAP":
                    protocol = IntegrationProtocol.SOAP;
                    return true;
                default:
                    return Enum.TryParse(value.Trim(), true, out protocol);
            }
        }

        public static IntegrationProtocol Parse(string? value)
        {
            if (TryParse(value, out IntegrationProtocol protocol))
            {
                return protocol;
            }

            throw new ArgumentOutOfRangeException(nameof(value), "Unknown integration protocol: " + value);
        }

        private static string Compact(string value)
        {
            return value.Trim().Replace(" ", string.Empty, StringComparison.Ordinal)
                .Replace("-", string.Empty, StringComparison.Ordinal)
                .Replace("_", string.Empty, StringComparison.Ordinal)
                .ToUpperInvariant();
        }
    }

    public sealed class IntegrationProtocolJsonConverter : JsonConverter<IntegrationProtocol>
    {
        public override IntegrationProtocol Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.String)
            {
                string? text = reader.GetString();
                if (IntegrationProtocolMap.TryParse(text, out IntegrationProtocol protocol))
                {
                    return protocol;
                }
            }

            throw new JsonException("Unknown integration protocol.");
        }

        public override void Write(Utf8JsonWriter writer, IntegrationProtocol value, JsonSerializerOptions options)
        {
            writer.WriteStringValue(IntegrationProtocolMap.ToStored(value));
        }
    }
}
