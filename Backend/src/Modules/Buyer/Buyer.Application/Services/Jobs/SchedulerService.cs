using Buyer.Domain.Common;
using Microsoft.Extensions.Configuration;
using Quartz;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services.Jobs
{
    public class SchedulerService : ISchedulerService
    {
        public const string DEFAULT_WEEKLY_BUCKET_REMINDER_CRON = "0 0 9 * * ?";

        private const string WEEKLY_BUCKET_GROUP = "weekly-bucket";

        // The scheduler of the application (the one AddQuartz and the hosted service use), not a second one: a job added here
        // is created by the same dependency-injection job factory as the other jobs, and starts with the hosted service.
        private readonly ISchedulerFactory _schedulerFactory;
        private readonly ILoggerManager _logger;
        private readonly IConfiguration _configuration;

        public SchedulerService(ISchedulerFactory schedulerFactory, ILoggerManager logger, IConfiguration configuration)
        {
            _schedulerFactory = schedulerFactory;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task ScheduleWeeklyBucketReminderJob(CancellationToken cancellationToken = default)
        {
            _logger.LogInfo("Scheduling WeeklyBucketReminderJob...");

            string cron = _configuration[Common.SCHEDULER_WEEKLY_BUCKET_REMINDER_CRON] ?? DEFAULT_WEEKLY_BUCKET_REMINDER_CRON;
            if (!CronExpression.IsValidExpression(cron))
            {
                _logger.LogError($"WeeklyBucketReminderJob not scheduled: '{cron}' is not a valid cron expression ({Common.SCHEDULER_WEEKLY_BUCKET_REMINDER_CRON}).");
                throw new InvalidOperationException($"'{Common.SCHEDULER_WEEKLY_BUCKET_REMINDER_CRON}' is not a valid cron expression.");
            }

            IScheduler scheduler = await _schedulerFactory.GetScheduler(cancellationToken);

            IJobDetail job = JobBuilder.Create<WeeklyBucketReminderJob>()
                .WithIdentity(nameof(WeeklyBucketReminderJob), WEEKLY_BUCKET_GROUP)
                .Build();

            ITrigger trigger = TriggerBuilder.Create()
                .WithIdentity($"{nameof(WeeklyBucketReminderJob)}Trigger", WEEKLY_BUCKET_GROUP)
                .WithCronSchedule(cron)
                .Build();

            await scheduler.ScheduleJob(job, new HashSet<ITrigger> { trigger }, true, cancellationToken);
            _logger.LogInfo($"Scheduled WeeklyBucketReminderJob. Cron: {cron}");
        }
    }
}
