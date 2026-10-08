using System.Text.Json;
using System.Text.RegularExpressions;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// Validation and field copy of an integration configuration, shared by the create and update
    /// commands of the Buyer and Supplier services. The check that an organization has one API per
    /// API type needs the service's own data and is made by the handler between the two steps.
    /// </summary>
    public static class IntegrationConfigurationRules
    {
        private static readonly Regex SafePath = new Regex(@"^[A-Za-z0-9_./$-]+$", RegexOptions.Compiled);
        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        private static readonly string[] HttpMethods = { "GET", "POST", "PUT", "PATCH" };
        private static readonly string[] PayloadFormats = { IntegrationConstants.PAYLOAD_JSON, IntegrationConstants.PAYLOAD_SOAP, IntegrationConstants.PAYLOAD_CXML };

        // Credentials belong in the sign-in fields, where they are stored encrypted.
        private static readonly string[] ReservedHeaderWords = { "authorization", "secret", "token", "key" };

        /// <summary>
        /// A header whose value is Fetch asks the engine for the CSRF handshake (SAP Gateway, S/4HANA: x-csrf-token: Fetch). The
        /// name is the API's own and is not fixed here. Such a header is never a credential: the token is fetched at call time and
        /// never stored.
        /// </summary>
        public static bool IsCsrfSwitch(string? value)
        {
            return string.Equals(value?.Trim(), "Fetch", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsAllowedHeader(string? name, string? value)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return false;
            }

            if (IsCsrfSwitch(value))
            {
                return !name.Contains("authorization", StringComparison.OrdinalIgnoreCase);
            }

            return !ReservedHeaderWords.Any(word => name.Contains(word, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Refuses an input the service cannot store. <paramref name="side"/> is the service's own side
        /// (Buyer or Supplier); <paramref name="organizationType"/> is the caller's, from the token.
        /// </summary>
        public static void Validate(ILoggerManager logger, IntegrationConfigurationInputDto input, string side, string? organizationType, Guid organizationId)
        {
            if (!string.Equals(side, organizationType, StringComparison.OrdinalIgnoreCase))
            {
                logger.LogError($"Integration belongs to another organization type. Side: {side}, OrganizationType: {organizationType}, OrganizationId: {organizationId}");
                throw new ForBiddenCustomException("Integrations are not available.", $"These integrations belong to {side.ToLowerInvariant()} organizations.");
            }

            if (string.IsNullOrWhiteSpace(input.Name) || string.IsNullOrWhiteSpace(input.EntityCode))
            {
                logger.LogError($"Integration name or entity code is missing. OrganizationId: {organizationId}");
                throw new BadRequestCustomException("Name and entity code are required.", "Enter the name and the entity code of the integration.");
            }

            if (!string.IsNullOrWhiteSpace(input.ResourcePath) && !SafePath.IsMatch(input.ResourcePath))
            {
                logger.LogError($"Integration resource path is invalid. OrganizationId: {organizationId}");
                throw new BadRequestCustomException("Invalid resource path.", "The resource path contains unsupported characters.");
            }

            // The Buyer service configures the buyer's API types and the Supplier service the supplier's.
            if (!IntegrationProcessCatalog.BelongsTo(input.ProcessType, side))
            {
                logger.LogError($"Integration process is not available. ProcessType: {input.ProcessType}, Side: {side}");
                throw new BadRequestCustomException("API type is not available.", "This API type is not available for your organization.");
            }

            string payloadFormat = PayloadFormat(input);
            if (!HttpMethods.Contains(HttpMethod(input)) || !PayloadFormats.Contains(payloadFormat))
            {
                logger.LogError($"Integration method or payload format is invalid. OrganizationId: {organizationId}");
                throw new BadRequestCustomException("Invalid method or payload format.", "Use GET, POST, PUT or PATCH, and JSON, SOAP or CXML.");
            }

            if (payloadFormat != IntegrationConstants.PAYLOAD_JSON && string.IsNullOrWhiteSpace(input.RequestBody))
            {
                logger.LogError($"Integration body template is missing. PayloadFormat: {payloadFormat}, OrganizationId: {organizationId}");
                throw new BadRequestCustomException("Request body is required.", "SOAP and cXML calls need the request body saved on this API.");
            }

            if (input.Headers != null && input.Headers.Any(header => !IsAllowedHeader(header.Key, header.Value)))
            {
                logger.LogError($"Integration header is not allowed. OrganizationId: {organizationId}");
                throw new BadRequestCustomException("Header is not allowed.", "Credentials go in the sign-in fields, not in the extra headers.");
            }

            if (!Uri.TryCreate(input.BaseUrl, UriKind.Absolute, out Uri? baseUri) || (baseUri.Scheme != Uri.UriSchemeHttp && baseUri.Scheme != Uri.UriSchemeHttps))
            {
                logger.LogError($"Integration base URL is invalid. OrganizationId: {organizationId}");
                throw new BadRequestCustomException("Invalid base URL.", "Base URL must be an absolute HTTPS or HTTP URL.");
            }
        }

        /// <summary>The 409 answer to a second API of the same type. It is logged here; the handler throws it.</summary>
        public static ConflictCustomException Duplicate(ILoggerManager logger, IntegrationConfigurationInputDto input, Guid organizationId)
        {
            logger.LogError($"Integration already exists. ProcessType: {input.ProcessType}, EntityCode: {input.EntityCode}, OrganizationId: {organizationId}");
            return new ConflictCustomException(
                "Integration already exists.",
                $"An API of this type is already configured for entity code {input.EntityCode?.Trim()}. Open it and edit it, or use another entity code (company code).");
        }

        /// <summary>Copies a validated input onto the configuration. Credentials are encrypted.</summary>
        public static void Apply(IIntegrationCredentialProtector credentials, ApiIntegrationConfiguration configuration, IntegrationConfigurationInputDto input)
        {
            Uri baseUri = new Uri(input.BaseUrl, UriKind.Absolute);
            configuration.EntityCode = input.EntityCode.Trim();
            configuration.Name = input.Name.Trim();
            configuration.ProcessType = input.ProcessType;
            configuration.Protocol = input.Protocol;
            configuration.BaseUrl = baseUri.ToString().TrimEnd('/');
            configuration.ResourcePath = input.ResourcePath?.Trim('/');
            configuration.AuthenticationType = input.AuthenticationType;
            configuration.Username = input.Username?.Trim();

            // A credential that is not sent again keeps its stored (encrypted) value.
            configuration.ProtectedPassword = credentials.Protect(input.Password) ?? configuration.ProtectedPassword;
            configuration.ProtectedClientId = credentials.Protect(input.ClientId) ?? configuration.ProtectedClientId;
            configuration.ProtectedClientSecret = credentials.Protect(input.ClientSecret) ?? configuration.ProtectedClientSecret;
            configuration.ProtectedBearerToken = credentials.Protect(input.BearerToken) ?? configuration.ProtectedBearerToken;
            configuration.TokenEndpoint = input.TokenEndpoint;
            configuration.TokenScope = input.TokenScope;
            configuration.TokenHeadersJson = input.TokenHeaders == null ? configuration.TokenHeadersJson : JsonSerializer.Serialize(input.TokenHeaders, JsonOptions);
            configuration.TokenBodyJson = input.TokenBody == null ? configuration.TokenBodyJson : JsonSerializer.Serialize(input.TokenBody, JsonOptions);
            configuration.TimeoutSeconds = input.TimeoutSeconds;
            configuration.RetryCount = input.RetryCount;
            configuration.PageSize = input.PageSize;
            configuration.WatermarkField = input.WatermarkField;
            configuration.ScheduleCron = input.ScheduleCron;
            configuration.SystemName = string.IsNullOrWhiteSpace(input.SystemName) ? null : input.SystemName.Trim();
            configuration.HttpMethod = HttpMethod(input);
            configuration.PayloadFormat = PayloadFormat(input);
            configuration.RequestBody = string.IsNullOrWhiteSpace(input.RequestBody) ? null : input.RequestBody;
            configuration.HeadersJson = input.Headers == null || input.Headers.Count == 0 ? null : JsonSerializer.Serialize(input.Headers, JsonOptions);
            configuration.ApiKeyHeader = string.IsNullOrWhiteSpace(input.ApiKeyHeader) ? null : input.ApiKeyHeader.Trim();
            configuration.ProtectedApiKey = credentials.Protect(input.ApiKey) ?? configuration.ProtectedApiKey;
        }

        /// <summary>The extra headers saved on a configuration, or null when there are none.</summary>
        public static Dictionary<string, string>? ReadHeaders(string? headersJson)
        {
            if (string.IsNullOrWhiteSpace(headersJson))
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<Dictionary<string, string>>(headersJson, JsonOptions);
            }
            catch (JsonException)
            {
                // Headers saved in a shape this version cannot read are treated as none.
                return null;
            }
        }

        // An API type that is read is called with GET; one the application sends to defaults to POST.
        private static string HttpMethod(IntegrationConfigurationInputDto input)
        {
            return string.IsNullOrWhiteSpace(input.HttpMethod)
                ? (IntegrationProcessCatalog.Find(input.ProcessType)?.IsPush == true ? "POST" : "GET")
                : input.HttpMethod.Trim().ToUpperInvariant();
        }

        private static string PayloadFormat(IntegrationConfigurationInputDto input)
        {
            return string.IsNullOrWhiteSpace(input.PayloadFormat) ? IntegrationConstants.PAYLOAD_JSON : input.PayloadFormat.Trim().ToUpperInvariant();
        }
    }
}
