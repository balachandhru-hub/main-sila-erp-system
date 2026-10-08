using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Quartz;
using Buyer.Application.Features.Commands.RunIntegration;
using Buyer.Application.Features.Queries.GetDueIntegrations;
using Buyer.Application.Features.Shared;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services.Jobs
{
    /// <summary>
    /// Quartz job that runs the scheduled pulls of the buyer's API types that are due. Each API runs in its own scope;
    /// one failing API is logged (it is already recorded as FAILED on its configuration) and the rest continue.
    /// Start/end are logged only when something is due.
    /// </summary>
    [DisallowConcurrentExecution]
    public class IntegrationSchedulerJob : IJob
    {
        private const string JOB_NAME = nameof(IntegrationSchedulerJob);

        private readonly IMediator _mediator;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILoggerManager _logger;

        public IntegrationSchedulerJob(IMediator mediator, IServiceScopeFactory scopeFactory, ILoggerManager logger)
        {
            _mediator = mediator;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task Execute(IJobExecutionContext context)
        {
            try
            {
                List<DueIntegrationDto> due = await _mediator.Send(new GetDueIntegrationsQuery(), context.CancellationToken);
                if (due.Count == 0)
                {
                    return;
                }

                _logger.LogInfo($"[{JOB_NAME}] start. Due: {due.Count}");
                Dictionary<Guid, Guid> organizationByConfiguration = due
                    .GroupBy(x => x.ConfigurationId)
                    .ToDictionary(x => x.Key, x => x.First().OrganizationId);
                int completed = 0;
                int failed = await SilaJobRunner.ForEachAsync(
                    _scopeFactory, _logger, JOB_NAME, "Configuration", organizationByConfiguration.Keys.ToList(),
                    async (mediator, configurationId, cancellationToken) =>
                    {
                        await mediator.Send(new RunIntegrationCommand
                        {
                            OrganizationId = organizationByConfiguration[configurationId],
                            ConfigurationId = configurationId,
                            Trigger = IntegrationExecutionTrigger.SCHEDULED,
                            FullSync = false
                        }, cancellationToken);
                        return true;
                    },
                    _ => completed++,
                    context.CancellationToken);
                _logger.LogInfo($"[{JOB_NAME}] end. Due: {due.Count}, Completed: {completed}, Failed: {failed}");
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError($"[{JOB_NAME}] end with error. Error: {SilaLogText.Short(exception.Message)}");
            }
        }
    }
}
