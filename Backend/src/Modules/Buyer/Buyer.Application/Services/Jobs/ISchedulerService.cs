namespace Buyer.Application.Services.Jobs
{
    /// <summary>
    /// Schedules the jobs that are added to the Quartz scheduler of the Buyer service in code, one method per job.
    /// </summary>
    public interface ISchedulerService
    {
        /// <summary>
        /// Schedules the weekly bucket reminder: a job that emails the store managers to freeze weekly buckets that are still
        /// open. The cron comes from Scheduler:WeeklyBucketReminderCron (default daily at 09:00). Calling it again replaces the
        /// job and its trigger, so it never schedules the reminder twice.
        /// </summary>
        /// <returns>Task representing the asynchronous operation.</returns>
        Task ScheduleWeeklyBucketReminderJob(CancellationToken cancellationToken = default);
    }
}
