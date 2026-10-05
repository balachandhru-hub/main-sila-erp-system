using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.LoggerServices;

namespace SharedKernel.Integration.Services
{
    /// <summary>
    /// Outbound HTTP executor of the ERP integration framework (REST and OData V4), shared by the Buyer and Supplier services.
    /// It talks to the remote system only; what is imported or stored is decided by the handlers.
    /// </summary>
    public class IntegrationHttpExecutor : IIntegrationHttpExecutor
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IIntegrationCredentialProtector _credentials;
        private readonly ILoggerManager _logger;

        public IntegrationHttpExecutor(IHttpClientFactory httpClientFactory, IIntegrationCredentialProtector credentials, ILoggerManager logger)
        {
            _httpClientFactory = httpClientFactory;
            _credentials = credentials;
            _logger = logger;
        }

        public string BuildUrl(ApiIntegrationConfiguration configuration, bool testOnly)
        {
            string url = Combine(configuration.BaseUrl, configuration.ResourcePath ?? string.Empty);
            if (configuration.Protocol == IntegrationProtocol.ODATA_V4)
            {
                string query = testOnly ? "$top=1" : $"$top={configuration.PageSize ?? 100}";
                if (!testOnly && !string.IsNullOrWhiteSpace(configuration.WatermarkField) && configuration.LastWatermark != null)
                {
                    query += $"&$filter={Uri.EscapeDataString(configuration.WatermarkField)}%20gt%20{Uri.EscapeDataString(configuration.LastWatermark.Value.ToUniversalTime().ToString("O"))}";
                }

                url += (url.Contains('?') ? "&" : "?") + query;
            }

            return url;
        }

        public string ResourceUrl(ApiIntegrationConfiguration configuration)
        {
            return Combine(configuration.BaseUrl, configuration.ResourcePath ?? string.Empty);
        }

        public string MetadataUrl(ApiIntegrationConfiguration configuration)
        {
            return Combine(configuration.BaseUrl, "$metadata");
        }

        public Task<HttpResponseMessage> SendAsync(ApiIntegrationConfiguration configuration, string url, HttpMethod method, string? body, CancellationToken cancellationToken)
        {
            return SendAsync(configuration, url, method, body, null, cancellationToken);
        }

        public Task<HttpResponseMessage> SendAsync(ApiIntegrationConfiguration configuration, string url, HttpMethod method, string? body, IReadOnlyDictionary<string, string>? callHeaders, CancellationToken cancellationToken)
        {
            return SendCoreAsync(configuration, url, method, body, callHeaders, Math.Max(1, configuration.RetryCount + 1), cancellationToken);
        }

        public Task<HttpResponseMessage> SendOnceAsync(ApiIntegrationConfiguration configuration, string url, HttpMethod method, string? body, IReadOnlyDictionary<string, string>? callHeaders, CancellationToken cancellationToken)
        {
            return SendCoreAsync(configuration, url, method, body, callHeaders, 1, cancellationToken);
        }

        private async Task<HttpResponseMessage> SendCoreAsync(ApiIntegrationConfiguration configuration, string url, HttpMethod method, string? body, IReadOnlyDictionary<string, string>? callHeaders, int attempts, CancellationToken cancellationToken)
        {
            Dictionary<string, string>? configuredHeaders = IntegrationConfigurationRules.ReadHeaders(configuration.HeadersJson);
            HttpClient client = _httpClientFactory.CreateClient(IntegrationConstants.HTTP_CLIENT_INTEGRATIONS);
            client.Timeout = TimeSpan.FromSeconds(configuration.TimeoutSeconds <= 0 ? 30 : configuration.TimeoutSeconds);
            for (int attempt = 1; attempt <= attempts; attempt++)
            {
                using HttpRequestMessage request = new HttpRequestMessage(method, url);
                // An OData $metadata document is XML; strict servers refuse it when JSON is asked for.
                bool isMetadata = url.EndsWith("$metadata", StringComparison.OrdinalIgnoreCase);
                request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(isMetadata ? "application/xml" : "application/json"));
                AddHeaders(request, configuredHeaders);
                AddHeaders(request, callHeaders);
                await AddAuthenticationAsync(configuration, request, client, cancellationToken);
                if (body != null)
                {
                    request.Content = new StringContent(body, Encoding.UTF8, MediaType(configuration.PayloadFormat));
                }

                try
                {
                    HttpResponseMessage response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                    if ((int)response.StatusCode >= 500 && attempt < attempts)
                    {
                        response.Dispose();
                        await Task.Delay(TimeSpan.FromMilliseconds(150 * attempt), cancellationToken);
                        continue;
                    }

                    return response;
                }
                catch (HttpRequestException) when (attempt < attempts)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(150 * attempt), cancellationToken);
                }
                catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested && attempt < attempts)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(150 * attempt), cancellationToken);
                }
                catch (HttpRequestException exception)
                {
                    _logger.LogError($"Integration endpoint could not be reached. ConfigurationId: {configuration.Id}, Error: {exception.Message}");
                    throw new IntegrationException("REMOTE_UNAVAILABLE", "The configured API could not be reached.", 424);
                }
                catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
                {
                    _logger.LogError($"Integration endpoint timed out. ConfigurationId: {configuration.Id}");
                    throw new IntegrationException("REMOTE_TIMEOUT", "The configured API did not answer in time.", 424);
                }
            }

            throw new IntegrationException("REMOTE_UNAVAILABLE", "The configured API could not be reached.", 424);
        }

        public List<IntegrationSchemaEntityDto> ParseMetadata(string xml)
        {
            XDocument document;
            try
            {
                document = XDocument.Parse(xml);
            }
            catch (XmlException)
            {
                throw new IntegrationException("SCHEMA_INVALID", "The OData metadata document is not valid XML.");
            }

            return document.Descendants().Where(item => item.Name.LocalName == "EntityType").Select(entity => new IntegrationSchemaEntityDto
            {
                Name = (string?)entity.Attribute("Name") ?? string.Empty,
                Properties = entity.Elements().Where(item => item.Name.LocalName == "Property").Select(property => new IntegrationSchemaPropertyDto
                {
                    Name = (string?)property.Attribute("Name") ?? string.Empty,
                    Type = ((string?)property.Attribute("Type") ?? "Edm.String").Replace("Edm.", string.Empty),
                    Nullable = (string?)property.Attribute("Nullable") != "false"
                }).ToList(),
                Keys = entity.Elements().Where(item => item.Name.LocalName == "Key").Elements()
                    .Select(item => (string?)item.Attribute("Name") ?? string.Empty)
                    .Where(item => item.Length > 0)
                    .ToList()
            }).ToList();
        }

        public async Task<List<JsonElement>> PullRecordsAsync(ApiIntegrationConfiguration configuration, bool fullSync, CancellationToken cancellationToken)
        {
            // A full sync ignores the watermark and reads everything again.
            DateTime? watermark = configuration.LastWatermark;
            if (fullSync)
            {
                configuration.LastWatermark = null;
            }

            string url = BuildUrl(configuration, false);
            configuration.LastWatermark = watermark;
            string payload;
            using (HttpResponseMessage response = await SendAsync(configuration, url, HttpMethod.Get, null, cancellationToken))
            {
                if (!response.IsSuccessStatusCode)
                {
                    throw new IntegrationException("REMOTE_HTTP_ERROR", $"The API returned HTTP {(int)response.StatusCode}.", 424);
                }

                payload = await response.Content.ReadAsStringAsync(cancellationToken);
            }

            return ReadRecords(payload);
        }

        public List<JsonElement> ReadRecords(string payload)
        {
            try
            {
                using JsonDocument document = JsonDocument.Parse(payload);
                if (document.RootElement.ValueKind == JsonValueKind.Array)
                {
                    return document.RootElement.EnumerateArray().Select(item => item.Clone()).ToList();
                }

                if (document.RootElement.ValueKind == JsonValueKind.Object
                    && document.RootElement.TryGetProperty("value", out JsonElement value) && value.ValueKind == JsonValueKind.Array)
                {
                    return value.EnumerateArray().Select(item => item.Clone()).ToList();
                }

                return new List<JsonElement> { document.RootElement.Clone() };
            }
            catch (JsonException)
            {
                throw new IntegrationException("REMOTE_PAYLOAD_INVALID", "The API did not return valid JSON.", 424);
            }
        }

        private async Task AddAuthenticationAsync(ApiIntegrationConfiguration configuration, HttpRequestMessage request, HttpClient client, CancellationToken cancellationToken)
        {
            switch (configuration.AuthenticationType)
            {
                case IntegrationAuthenticationType.API_KEY:
                    request.Headers.TryAddWithoutValidation(
                        string.IsNullOrWhiteSpace(configuration.ApiKeyHeader) ? IntegrationConstants.DEFAULT_API_KEY_HEADER : configuration.ApiKeyHeader,
                        _credentials.Unprotect(configuration.ProtectedApiKey));
                    break;
                case IntegrationAuthenticationType.BASIC:
                    request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                        Convert.ToBase64String(Encoding.UTF8.GetBytes($"{configuration.Username}:{_credentials.Unprotect(configuration.ProtectedPassword)}")));
                    break;
                case IntegrationAuthenticationType.BEARER_TOKEN:
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _credentials.Unprotect(configuration.ProtectedBearerToken));
                    break;
                case IntegrationAuthenticationType.OAUTH2_CLIENT_CREDENTIALS:
                case IntegrationAuthenticationType.CUSTOM_TOKEN_ENDPOINT:
                {
                    if (string.IsNullOrWhiteSpace(configuration.TokenEndpoint))
                    {
                        throw new IntegrationException("TOKEN_ENDPOINT_REQUIRED", "A token endpoint is required for this authentication type.");
                    }

                    using HttpRequestMessage tokenRequest = new HttpRequestMessage(HttpMethod.Post, configuration.TokenEndpoint);
                    tokenRequest.Content = new FormUrlEncodedContent(new Dictionary<string, string>
                    {
                        ["grant_type"] = "client_credentials",
                        ["client_id"] = _credentials.Unprotect(configuration.ProtectedClientId) ?? string.Empty,
                        ["client_secret"] = _credentials.Unprotect(configuration.ProtectedClientSecret) ?? string.Empty,
                        ["scope"] = configuration.TokenScope ?? string.Empty
                    });
                    using HttpResponseMessage tokenResponse = await client.SendAsync(tokenRequest, cancellationToken);
                    if (!tokenResponse.IsSuccessStatusCode)
                    {
                        throw new IntegrationException("TOKEN_REQUEST_FAILED", "The token endpoint rejected the configured credentials.", 424);
                    }

                    using JsonDocument tokenJson = JsonDocument.Parse(await tokenResponse.Content.ReadAsStringAsync(cancellationToken));
                    if (!tokenJson.RootElement.TryGetProperty("access_token", out JsonElement token))
                    {
                        throw new IntegrationException("TOKEN_RESPONSE_INVALID", "The token endpoint did not return an access token.", 424);
                    }

                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.GetString());
                    break;
                }
            }
        }

        private static void AddHeaders(HttpRequestMessage request, IReadOnlyDictionary<string, string>? headers)
        {
            if (headers == null)
            {
                return;
            }

            foreach (KeyValuePair<string, string> header in headers)
            {
                request.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }
        }

        private static string MediaType(string? payloadFormat)
        {
            return payloadFormat switch
            {
                IntegrationConstants.PAYLOAD_SOAP => "application/soap+xml",
                IntegrationConstants.PAYLOAD_CXML => "application/xml",
                _ => "application/json"
            };
        }

        private static string Combine(string baseUrl, string path)
        {
            return $"{baseUrl.TrimEnd('/')}/{path.TrimStart('/')}";
        }
    }
}
