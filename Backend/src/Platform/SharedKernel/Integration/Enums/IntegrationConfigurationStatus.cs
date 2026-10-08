using System.Text.Json.Serialization;

namespace SharedKernel.Integration.Enums
{
    /// <summary>
    /// Life cycle of an API configuration: it is tested before it can be activated. Sent and read as its name.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IntegrationConfigurationStatus
    {
        DRAFT,
        TEST_FAILED,
        TESTED,
        ACTIVE,
        INACTIVE
    }
}
