using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Quartz;
using Buyer.Application.Features.Commands.RunWeeklyBucketAutomation;
using Buyer.Application.Features.Queries.GetSilaJobBuyers;
using Buyer.Application.Features.Shared;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services.Jobs
{
    /// <summary>
    /// Quartz job (cron Scheduler:WeeklyBucketCron). For every buyer with an approved weekly bucket it creates the purchase
    /// orders once the weekend of the bucket's week has started. The reminder to freeze open buckets is a separate job
    /// (WeeklyBucketReminderJob). Each buyer runs in its own scope; one failing buyer is logged and the others continue.
    /// </summary>
    [DisallowConcurrentExecution]
    public class WeeklyBucketAutomationJob : IJob
    {
        private const string JOB_NAME = nameof(WeeklyBucketAutomationJob);

        private readonly IMediator _mediator;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILoggerManager _logger;

        public WeeklyBucketAutomationJob(IMediator mediator, IServiceScopeFactory scopeFactory, ILoggerManager logger)
        {
            _mediator = mediator;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task Execute(IJobExecutionContext context)
        {
            try
            {
                List<Guid> buyerIds = await _mediator.Send(new GetSilaJobBuyersQuery { Job = GetSilaJobBuyersQuery.JOB_WEEKLY_BUCKET }, context.CancellationToken);
                if (buyerIds.Count == 0)
                {
                    return;
                }

                _logger.LogInfo($"[{JOB_NAME}] start. Buyers: {buyerIds.Count}");
                int purchaseOrderRuns = 0;
                int failed = await SilaJobRunner.ForEachAsync(
                    _scopeFactory, _logger, JOB_NAME, "Buyer", buyerIds,
                    (mediator, buyerId, cancellationToken) => mediator.Send(new RunWeeklyBucketAutomationCommand { BuyerId = buyerId }, cancellationToken),
                    runs => purchaseOrderRuns += runs,
                    context.CancellationToken);
                _logger.LogInfo($"[{JOB_NAME}] end. Buyers: {buyerIds.Count}, Failed: {failed}, PurchaseOrderRuns: {purchaseOrderRuns}");
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError($"[{JOB_NAME}] end with error. Error: {SilaLogText.Short(exception.Message)}");
            }
        }
    }
}
