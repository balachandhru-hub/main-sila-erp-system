using MediatR;
using Quartz;
using Supplier.Application.Features.Commands.RunIntegration;
using Supplier.Application.Features.Queries.GetDueIntegrations;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Supplier.Application.Services.Jobs
{
    /// <summary>
    /// Quartz job that runs the scheduled pulls of the supplier's API types that are due.
    /// One failing API is logged and the rest of the batch continues.
    /// </summary>
    [DisallowConcurrentExecution]
    public class IntegrationSchedulerJob : IJob
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public IntegrationSchedulerJob(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        public async Task Execute(IJobExecutionContext context)
        {
            List<DueIntegrationDto> due = await _mediator.Send(new GetDueIntegrationsQuery(), context.CancellationToken);
            if (due.Count == 0)
            {
                return;
            }

            _logger.LogInfo($"[IntegrationSchedulerJob] Started. Due: {due.Count}");
            int failed = 0;
            foreach (DueIntegrationDto item in due)
            {
                try
                {
                    await _mediator.Send(new RunIntegrationCommand
                    {
                        OrganizationId = item.OrganizationId,
                        ConfigurationId = item.ConfigurationId,
                        Trigger = IntegrationExecutionTrigger.SCHEDULED,
                        FullSync = false
                    }, context.CancellationToken);
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    // The run is already recorded as FAILED on the configuration; the next one continues.
                    failed++;
                    _logger.LogError($"[IntegrationSchedulerJob] Integration failed. ConfigurationId: {item.ConfigurationId}, Error: {exception.Message}");
                }
            }
            _logger.LogInfo($"[IntegrationSchedulerJob] Completed. Due: {due.Count}, Failed: {failed}");
        }
    }
}
