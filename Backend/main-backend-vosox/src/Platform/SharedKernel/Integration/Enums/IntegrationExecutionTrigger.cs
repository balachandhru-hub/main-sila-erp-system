using System.Text.Json.Serialization;

namespace SharedKernel.Integration.Enums
{
    /// <summary>
    /// What started a run of an API configuration. Sent and read as its name.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IntegrationExecutionTrigger
    {
        TEST,
        MANUAL,
        SCHEDULED,
        RETRY
    }
}
