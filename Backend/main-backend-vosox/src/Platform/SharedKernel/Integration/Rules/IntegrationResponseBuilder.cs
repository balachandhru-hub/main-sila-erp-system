using System.Text.Json;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Services;

namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// Builds the response DTOs of the integration endpoints. Credentials are never returned.
    /// Timestamps are stored in UTC and returned marked as UTC.
    /// </summary>
    public static class IntegrationResponseBuilder
    {
        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        public static IntegrationConfigurationResponseDto Integration(ApiIntegrationConfiguration item, IIntegrationCredentialProtector credentials)
        {
            return new IntegrationConfigurationResponseDto
            {
                Id = item.Id,
                OrganizationId = item.OrganizationId,
                EntityCode = item.EntityCode,
                Name = item.Name,
                ProcessType = item.ProcessType,
                Protocol = item.Protocol,
                BaseUrl = item.BaseUrl,
                ResourcePath = item.ResourcePath,
                AuthenticationType = item.AuthenticationType,
                Username = item.Username,
                CredentialStatus = credentials.State(item),
                TimeoutSeconds = item.TimeoutSeconds,
                RetryCount = item.RetryCount,
                PageSize = item.PageSize,
                WatermarkField = item.WatermarkField,
                LastWatermark = Utc(item.LastWatermark),
                LastAttemptAt = Utc(item.LastAttemptAt),
                LastSuccessfulRunAt = Utc(item.LastSuccessfulRunAt),
                NextRunAt = Utc(item.NextRunAt),
                IsRunning = item.IsRunning,
                LastErrorSafe = item.LastErrorSafe,
                ScheduleCron = item.ScheduleCron,
                Status = item.Status,
                TestedAt = Utc(item.TestedAt),
                CreatedAt = Utc(item.DateCreated),
                UpdatedAt = Utc(item.DateUpdated),
                SystemName = item.SystemName,
                HttpMethod = item.HttpMethod,
                PayloadFormat = item.PayloadFormat,
                RequestBody = item.RequestBody,
                Headers = IntegrationConfigurationRules.ReadHeaders(item.HeadersJson),
                ApiKeyHeader = item.ApiKeyHeader
            };
        }

        public static IntegrationMappingResponseDto Mapping(ApiFieldMapping item)
        {
            return new IntegrationMappingResponseDto
            {
                Id = item.Id,
                ConfigurationId = item.ConfigurationId,
                SourceField = item.SourceField,
                TargetField = item.TargetField,
                Transformation = item.Transformation,
                NullPolicy = item.NullPolicy,
                DefaultValue = item.DefaultValue,
                IsValidated = item.IsValidated,
                UpdatedAt = Utc(item.DateUpdated)
            };
        }

        public static IntegrationExecutionResponseDto Execution(ApiIntegrationExecution item)
        {
            return new IntegrationExecutionResponseDto
            {
                Id = item.Id,
                ConfigurationId = item.ConfigurationId,
                Trigger = item.Trigger,
                Status = item.Status,
                StartedAt = Utc(item.StartedAt),
                CompletedAt = Utc(item.CompletedAt),
                RecordsRead = item.RecordsRead,
                RecordsCreated = item.RecordsCreated,
                RecordsUpdated = item.RecordsUpdated,
                RecordsFailed = item.RecordsFailed,
                WatermarkBefore = Utc(item.WatermarkBefore),
                WatermarkAfter = Utc(item.WatermarkAfter),
                ErrorCode = item.ErrorCode,
                ErrorMessageSafe = item.ErrorMessageSafe
            };
        }

        public static IntegrationSchemaResponseDto Schema(IntegrationSchemaSnapshot snapshot)
        {
            return new IntegrationSchemaResponseDto
            {
                ConfigurationId = snapshot.ConfigurationId,
                MetadataUrl = snapshot.MetadataUrl,
                DiscoveredAt = Utc(snapshot.DiscoveredAt),
                Entities = JsonSerializer.Deserialize<List<IntegrationSchemaEntityDto>>(snapshot.SchemaJson, JsonOptions)
                    ?? new List<IntegrationSchemaEntityDto>()
            };
        }

        // SQL Server returns datetime2 without a kind; every value of the integration tables is UTC.
        private static DateTime Utc(DateTime value)
        {
            return value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : DateTime.SpecifyKind(value, DateTimeKind.Utc);
        }

        private static DateTime? Utc(DateTime? value)
        {
            return value == null ? null : Utc(value.Value);
        }
    }
}
