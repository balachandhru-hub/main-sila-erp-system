using System.Text.Json.Serialization;

namespace SharedKernel.Integration.Enums
{
    /// <summary>
    /// Protocol of an external API. Sent and read as its name.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IntegrationProtocol
    {
        REST,
        ODATA_V4
    }
}
