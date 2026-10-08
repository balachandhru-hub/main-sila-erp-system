using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Quartz;
using Buyer.Application.Features.Commands.PullSilaPosSales;
using Buyer.Application.Features.Queries.GetSilaPosPullOrganizations;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services.Jobs
{
    /// <summary>
    /// Quartz job (daily, cron Scheduler:PosSalesPullCron) that pulls the POS sales of every buyer with an active
    /// POS sales API and processes them. Each buyer runs in its own scope; one failing buyer is logged and the rest continue.
    /// </summary>
    [DisallowConcurrentExecution]
    public class PosSalesPullJob : IJob
    {
        private const string JOB_NAME = nameof(PosSalesPullJob);

        private readonly IMediator _mediator;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILoggerManager _logger;

        public PosSalesPullJob(IMediator mediator, IServiceScopeFactory scopeFactory, ILoggerManager logger)
        {
            _mediator = mediator;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task Execute(IJobExecutionContext context)
        {
            _logger.LogInfo($"[{JOB_NAME}] start");
            try
            {
                List<Guid> organizationIds = await _mediator.Send(new GetSilaPosPullOrganizationsQuery(), context.CancellationToken);
                int accepted = 0;
                int failed = await SilaJobRunner.ForEachAsync(
                    _scopeFactory, _logger, JOB_NAME, "Organization", organizationIds,
                    (mediator, organizationId, cancellationToken) => mediator.Send(new PullSilaPosSalesCommand
                    {
                        OrganizationId = organizationId,
                        UserId = Guid.Empty
                    }, cancellationToken),
                    (SilaPosImportResultDto result) => accepted += result.Accepted,
                    context.CancellationToken);
                _logger.LogInfo($"[{JOB_NAME}] end. Buyers: {organizationIds.Count}, Failed: {failed}, Accepted: {accepted}");
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // The next daily run pulls again.
                _logger.LogError($"[{JOB_NAME}] end with error. Error: {SilaLogText.Short(exception.Message)}");
            }
        }
    }
}
