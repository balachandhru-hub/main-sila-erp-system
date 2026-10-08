using System.Text.Json.Serialization;

namespace SharedKernel.Integration.Enums
{
    /// <summary>
    /// What a field mapping does with a value the API does not send. Sent and read as its name.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IntegrationNullPolicy
    {
        IGNORE_NULL,
        WRITE_NULL,
        DEFAULT_VALUE
    }
}
