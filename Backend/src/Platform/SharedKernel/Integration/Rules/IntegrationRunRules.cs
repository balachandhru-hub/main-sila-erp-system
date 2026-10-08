using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Services;

namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// The bookkeeping of a pull (manual or scheduled run) of an integration configuration: the
    /// execution record, the outcome written on the configuration and the next scheduled run.
    /// What the records are used for is decided by the service's run handler.
    /// </summary>
    public static class IntegrationRunRules
    {
        public static ApiIntegrationExecution NewExecution(ApiIntegrationConfiguration configuration, IntegrationExecutionTrigger trigger, bool fullSync)
        {
            return new ApiIntegrationExecution
            {
                Id = Guid.NewGuid(),
                ConfigurationId = configuration.Id,
                Trigger = trigger,
                Status = IntegrationExecutionStatus.RUNNING,
                StartedAt = DateTime.UtcNow,
                WatermarkBefore = fullSync ? null : configuration.LastWatermark
            };
        }

        /// <summary>Refuses a run of an API type that cannot be pulled, or of one whose fields are not mapped.</summary>
        public static void EnsureRunnable(ApiIntegrationConfiguration configuration, List<ApiFieldMapping> mappings)
        {
            if (IntegrationProcessCatalog.Find(configuration.ProcessType)?.CanPull != true)
            {
                throw new IntegrationException("PROCESS_NOT_IMPLEMENTED", "This API type is called by the application; it cannot be pulled.");
            }

            if (mappings.Count == 0)
            {
                throw new IntegrationException("MAPPING_REQUIRED", "Map the fields of this integration before running it.");
            }
        }

        /// <summary>Records a run that read the API: SUCCESS, or PARTIAL when some records failed.</summary>
        public static void Complete(ApiIntegrationConfiguration configuration, ApiIntegrationExecution execution)
        {
            DateTime now = DateTime.UtcNow;
            execution.Status = execution.RecordsFailed > 0 ? IntegrationExecutionStatus.PARTIAL : IntegrationExecutionStatus.SUCCESS;
            execution.WatermarkAfter = configuration.LastWatermark;
            execution.CompletedAt = now;
            configuration.LastSuccessfulRunAt = now;
            configuration.LastErrorSafe = execution.RecordsFailed > 0 ? execution.ErrorMessageSafe : null;
            configuration.NextRunAt = NextRun(configuration);
            configuration.IsRunning = false;
            configuration.RunningSince = null;
        }

        /// <summary>
        /// Records a failed run on a fresh execution record (the changes of the failed run are dropped
        /// by the caller) and releases the configuration.
        /// </summary>
        public static ApiIntegrationExecution Fail(
            ApiIntegrationConfiguration configuration,
            IntegrationExecutionTrigger trigger,
            bool fullSync,
            ApiIntegrationExecution attempted,
            IntegrationException failure)
        {
            ApiIntegrationExecution failed = NewExecution(configuration, trigger, fullSync);
            failed.StartedAt = attempted.StartedAt;
            failed.RecordsRead = attempted.RecordsRead;
            failed.Status = IntegrationExecutionStatus.FAILED;
            failed.CompletedAt = DateTime.UtcNow;
            failed.ErrorCode = failure.Code;
            failed.ErrorMessageSafe = failure.Message;
            configuration.LastErrorSafe = failure.Message;
            configuration.NextRunAt = NextRun(configuration);
            configuration.IsRunning = false;
            configuration.RunningSince = null;
            return failed;
        }

        /// <summary>Records one record that could not be read; it does not stop the run.</summary>
        public static void RecordFailed(ApiIntegrationExecution execution, string message)
        {
            execution.RecordsFailed++;
            execution.ErrorMessageSafe = message;
        }

        // The schedule field switches the scheduled pull on; a scheduled integration is pulled every 15 minutes.
        private static DateTime? NextRun(ApiIntegrationConfiguration configuration)
        {
            return string.IsNullOrWhiteSpace(configuration.ScheduleCron) || configuration.Status != IntegrationConfigurationStatus.ACTIVE
                ? null
                : DateTime.UtcNow.AddMinutes(15);
        }
    }
}
