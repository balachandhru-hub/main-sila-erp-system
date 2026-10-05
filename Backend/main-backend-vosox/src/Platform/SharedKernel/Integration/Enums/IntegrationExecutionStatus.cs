using System.Text.Json.Serialization;

namespace SharedKernel.Integration.Enums
{
    /// <summary>
    /// Outcome of one run of an API configuration. Sent and read as its name.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IntegrationExecutionStatus
    {
        RUNNING,
        SUCCESS,
        PARTIAL,
        FAILED
    }
}
