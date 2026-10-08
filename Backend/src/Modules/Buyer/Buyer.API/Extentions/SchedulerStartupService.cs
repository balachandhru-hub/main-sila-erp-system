using Buyer.Application.Services.Jobs;
using SharedKernel.LoggerServices;

namespace Buyer.API.Extensions
{
    /// <summary>
    /// Adds the jobs of <see cref="ISchedulerService"/> to the scheduler when the application starts. A job that cannot be
    /// scheduled (for example a wrong cron setting) is logged and does not stop the application.
    /// </summary>
    public class SchedulerStartupService : IHostedService
    {
        private readonly ISchedulerService _schedulerService;
        private readonly ILoggerManager _logger;

        public SchedulerStartupService(ISchedulerService schedulerService, ILoggerManager logger)
        {
            _schedulerService = schedulerService;
            _logger = logger;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            try
            {
                await _schedulerService.ScheduleWeeklyBucketReminderJob(cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError($"Scheduler jobs could not be scheduled. Error: {exception.Message}");
            }
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }
}
