using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Services;

namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// Calls the configured API once (one record) and writes the result on the configuration and on
    /// the test's execution record. A failed call is a result, not an error.
    /// </summary>
    public static class IntegrationTestRules
    {
        public static ApiIntegrationExecution NewExecution(ApiIntegrationConfiguration configuration)
        {
            return new ApiIntegrationExecution
            {
                Id = Guid.NewGuid(),
                ConfigurationId = configuration.Id,
                Trigger = IntegrationExecutionTrigger.TEST,
                Status = IntegrationExecutionStatus.RUNNING,
                StartedAt = DateTime.UtcNow
            };
        }

        public static async Task<IntegrationTestResponseDto> RunAsync(
            IIntegrationHttpExecutor executor,
            ApiIntegrationConfiguration configuration,
            ApiIntegrationExecution execution,
            CancellationToken cancellationToken)
        {
            bool success;
            string message;
            int? httpStatus;
            string? errorCode = null;
            try
            {
                using HttpResponseMessage response = await executor.SendAsync(configuration, executor.BuildUrl(configuration, true), HttpMethod.Get, null, cancellationToken);
                httpStatus = (int)response.StatusCode;

                // A POST-only endpoint answers a probe with 405: it is reachable and the credentials were accepted.
                success = response.IsSuccessStatusCode || (IntegrationProcessCatalog.Find(configuration.ProcessType)?.IsPush == true && httpStatus == 405);
                message = success ? "API connection succeeded." : $"The API returned HTTP {httpStatus}.";
                errorCode = success ? null : "REMOTE_HTTP_ERROR";
            }
            catch (IntegrationException exception)
            {
                success = false;
                message = exception.Message;
                httpStatus = exception.Status;
                errorCode = exception.Code;
            }

            DateTime testedAt = DateTime.UtcNow;
            execution.Status = success ? IntegrationExecutionStatus.SUCCESS : IntegrationExecutionStatus.FAILED;
            execution.CompletedAt = testedAt;
            execution.ErrorCode = errorCode;
            execution.ErrorMessageSafe = success ? null : message;
            configuration.TestedAt = testedAt;
            configuration.LastErrorSafe = success ? null : message;
            if (configuration.Status != IntegrationConfigurationStatus.ACTIVE || !success)
            {
                configuration.Status = success ? IntegrationConfigurationStatus.TESTED : IntegrationConfigurationStatus.TEST_FAILED;
            }

            return new IntegrationTestResponseDto
            {
                Success = success,
                Message = message,
                HttpStatus = httpStatus,
                TestedAt = DateTime.SpecifyKind(testedAt, DateTimeKind.Utc)
            };
        }
    }
}
