using System.Globalization;
using System.Text.Json;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;

namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// Reads mapped values out of one record of an ERP payload.
    /// </summary>
    public static class IntegrationRecordReader
    {
        public static string? Read(IReadOnlyList<ApiFieldMapping> mappings, string targetField, JsonElement record)
        {
            ApiFieldMapping? mapping = mappings.FirstOrDefault(item => item.TargetField.Equals(targetField, StringComparison.OrdinalIgnoreCase));
            return MapValue(mapping, record);
        }

        public static string? MapValue(ApiFieldMapping? mapping, JsonElement source)
        {
            if (mapping == null)
            {
                return null;
            }

            JsonElement? value = ReadPath(source, mapping.SourceField);
            if (value == null || value.Value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            {
                return mapping.NullPolicy == IntegrationNullPolicy.DEFAULT_VALUE ? mapping.DefaultValue : null;
            }

            string? text = value.Value.ValueKind == JsonValueKind.String ? value.Value.GetString() : value.Value.ToString();
            return mapping.Transformation switch
            {
                "TRIM" => text?.Trim(),
                "UPPER" => text?.Trim().ToUpperInvariant(),
                "LOWER" => text?.Trim().ToLowerInvariant(),
                _ => text
            };
        }

        public static JsonElement? ReadPath(JsonElement source, string path)
        {
            JsonElement current = source;
            foreach (string segment in path.Split(new[] { '.', '/' }, StringSplitOptions.RemoveEmptyEntries))
            {
                if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(segment, out current))
                {
                    return null;
                }
            }

            return current;
        }

        public static decimal? ParseDecimal(string? value)
        {
            return decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal result) ? result : null;
        }
    }
}
