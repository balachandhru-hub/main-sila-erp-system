using System.Text.Json;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;

namespace SharedKernel.Integration.Services
{
    public interface IIntegrationHttpExecutor
    {
        /// <summary>URL of the configured resource. A test call reads one record only.</summary>
        string BuildUrl(ApiIntegrationConfiguration configuration, bool testOnly);

        string MetadataUrl(ApiIntegrationConfiguration configuration);

        /// <summary>URL of the configured resource as it is, for a call that sends a document.</summary>
        string ResourceUrl(ApiIntegrationConfiguration configuration);

        /// <summary>
        /// Sends a document exactly once. A document that may already have been created must not be
        /// sent again automatically, so this call is never retried.
        /// </summary>
        Task<HttpResponseMessage> SendOnceAsync(ApiIntegrationConfiguration configuration, string url, HttpMethod method, string? body, IReadOnlyDictionary<string, string>? callHeaders, CancellationToken cancellationToken);

        /// <summary>Sends the request with the configured authentication, timeout and retries.</summary>
        Task<HttpResponseMessage> SendAsync(ApiIntegrationConfiguration configuration, string url, HttpMethod method, string? body, CancellationToken cancellationToken);

        /// <summary>Same, with headers that belong to this one call (an idempotency key, a correlation id).</summary>
        Task<HttpResponseMessage> SendAsync(ApiIntegrationConfiguration configuration, string url, HttpMethod method, string? body, IReadOnlyDictionary<string, string>? callHeaders, CancellationToken cancellationToken);

        List<IntegrationSchemaEntityDto> ParseMetadata(string xml);

        List<JsonElement> ReadRecords(string payload);

        /// <summary>
        /// Reads the configured resource (GET) and returns its records. A full read ignores the
        /// watermark. A failed call is raised as <see cref="IntegrationException"/>.
        /// </summary>
        Task<List<JsonElement>> PullRecordsAsync(ApiIntegrationConfiguration configuration, bool fullSync, CancellationToken cancellationToken);
    }
}
