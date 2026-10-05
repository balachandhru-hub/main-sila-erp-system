using System.Text.Json;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// Reads the OData $metadata of a configured service into a schema snapshot (not yet stored).
    /// </summary>
    public static class IntegrationSchemaRules
    {
        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        public static async Task<IntegrationSchemaSnapshot> DiscoverAsync(
            IIntegrationHttpExecutor executor,
            ILoggerManager logger,
            ApiIntegrationConfiguration configuration,
            CancellationToken cancellationToken)
        {
            if (configuration.Protocol != IntegrationProtocol.ODATA_V4)
            {
                logger.LogError($"Schema discovery is not supported for this protocol. ConfigurationId: {configuration.Id}, Protocol: {configuration.Protocol}");
                throw new BadRequestCustomException("Schema discovery is not supported.", "Schema discovery is available for OData V4 configurations.");
            }

            string metadataUrl = executor.MetadataUrl(configuration);
            List<IntegrationSchemaEntityDto> entities;
            try
            {
                using HttpResponseMessage response = await executor.SendAsync(configuration, metadataUrl, HttpMethod.Get, null, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    throw new IntegrationException("SCHEMA_REQUEST_FAILED", $"The OData metadata request returned HTTP {(int)response.StatusCode}.", 424);
                }

                entities = executor.ParseMetadata(await response.Content.ReadAsStringAsync(cancellationToken));
            }
            catch (IntegrationException exception)
            {
                logger.LogError($"Schema discovery failed. ConfigurationId: {configuration.Id}, Code: {exception.Code}");
                throw IntegrationErrors.ToCustomException(exception);
            }

            return new IntegrationSchemaSnapshot
            {
                Id = Guid.NewGuid(),
                ConfigurationId = configuration.Id,
                MetadataUrl = metadataUrl,
                SchemaJson = JsonSerializer.Serialize(entities, JsonOptions),
                DiscoveredAt = DateTime.UtcNow
            };
        }
    }
}
