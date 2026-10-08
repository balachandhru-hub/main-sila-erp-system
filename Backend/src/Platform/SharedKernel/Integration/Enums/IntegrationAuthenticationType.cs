using System.Text.Json.Serialization;

namespace SharedKernel.Integration.Enums
{
    /// <summary>
    /// How the application signs in to an external API. Sent and read as its name.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IntegrationAuthenticationType
    {
        NONE,
        BASIC,
        BEARER_TOKEN,
        OAUTH2_CLIENT_CREDENTIALS,
        CUSTOM_TOKEN_ENDPOINT,
        API_KEY
    }
}
