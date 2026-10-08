using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Quartz;
using Buyer.Application.Features.Commands.SendWeeklyBucketReminders;
using Buyer.Application.Features.Queries.GetSilaJobBuyers;
using Buyer.Application.Features.Shared;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services.Jobs
{
    /// <summary>
    /// Quartz job that emails the store managers to freeze weekly buckets that are still open. It is scheduled by
    /// <see cref="SchedulerService"/> (cron Scheduler:WeeklyBucketReminderCron). For every buyer with an open bucket it
    /// reminds from the reminder day of the bucket's week (WeeklyBucket:ReminderStartDay) until the bucket is frozen: one
    /// email per bucket per day. Each buyer runs in its own scope; one failing buyer is logged and the others continue.
    /// </summary>
    [DisallowConcurrentExecution]
    public class WeeklyBucketReminderJob : IJob
    {
        private const string JOB_NAME = nameof(WeeklyBucketReminderJob);

        private readonly IMediator _mediator;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILoggerManager _logger;

        public WeeklyBucketReminderJob(IMediator mediator, IServiceScopeFactory scopeFactory, ILoggerManager logger)
        {
            _mediator = mediator;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task Execute(IJobExecutionContext context)
        {
            try
            {
                List<Guid> buyerIds = await _mediator.Send(
                    new GetSilaJobBuyersQuery { Job = GetSilaJobBuyersQuery.JOB_WEEKLY_BUCKET_REMINDER }, context.CancellationToken);
                if (buyerIds.Count == 0)
                {
                    return;
                }

                _logger.LogInfo($"[{JOB_NAME}] start. Buyers: {buyerIds.Count}");
                int remindersSent = 0;
                int failed = await SilaJobRunner.ForEachAsync(
                    _scopeFactory, _logger, JOB_NAME, "Buyer", buyerIds,
                    (mediator, buyerId, cancellationToken) => mediator.Send(new SendWeeklyBucketRemindersCommand { BuyerId = buyerId }, cancellationToken),
                    sent => remindersSent += sent,
                    context.CancellationToken);
                _logger.LogInfo($"[{JOB_NAME}] end. Buyers: {buyerIds.Count}, Failed: {failed}, RemindersSent: {remindersSent}");
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError($"[{JOB_NAME}] end with error. Error: {SilaLogText.Short(exception.Message)}");
            }
        }
    }
}
