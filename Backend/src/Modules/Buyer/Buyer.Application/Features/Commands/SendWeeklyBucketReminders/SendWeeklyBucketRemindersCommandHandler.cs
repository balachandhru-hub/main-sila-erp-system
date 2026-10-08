using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SendWeeklyBucketReminders
{
    public class SendWeeklyBucketRemindersCommandHandler : IRequestHandler<SendWeeklyBucketRemindersCommand, int>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IIdentityApiClient _identityApiClient;
        private readonly IMetadataApiClient _metadataApiClient;
        private readonly IConfiguration _configuration;
        private readonly ILoggerManager _logger;

        public SendWeeklyBucketRemindersCommandHandler(
            IRepositoryWrapper repository,
            IIdentityApiClient identityApiClient,
            IMetadataApiClient metadataApiClient,
            IConfiguration configuration,
            ILoggerManager logger)
        {
            _repository = repository;
            _identityApiClient = identityApiClient;
            _metadataApiClient = metadataApiClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<int> Handle(SendWeeklyBucketRemindersCommand request, CancellationToken cancellationToken)
        {
            List<WeeklyBucket> buckets = await _repository.WeeklyBucket
                .FindByCondition(x => x.BuyerId == request.BuyerId && x.IsActive && x.Status == Common.WEEKLY_BUCKET_OPEN)
                .ToListAsync(cancellationToken);
            DateTime now = DateTime.UtcNow;

            int sent = 0;
            foreach (WeeklyBucket bucket in buckets)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (now >= WeeklyBucketRules.ReminderStart(bucket.Year, bucket.WeekNumber, _configuration))
                {
                    sent += await RemindAsync(bucket, now, cancellationToken);
                }
            }

            return sent;
        }

        // One reminder per bucket per day, until the bucket is frozen. The day is recorded in the bucket's audit trail.
        private async Task<int> RemindAsync(WeeklyBucket bucket, DateTime now, CancellationToken cancellationToken)
        {
            string today = now.ToString("yyyy-MM-dd");
            List<WeeklyBucketAudit> audit = await _repository.WeeklyBucket.GetAuditAsync(bucket.Id, cancellationToken);
            if (audit.Any(x => x.Action == Common.AUDIT_REMINDER_SENT && x.Detail != null && x.Detail.StartsWith(today)))
            {
                return 0;
            }

            List<IdentityUserDto> storeManagers;
            try
            {
                storeManagers = await _identityApiClient.GetUsersByRoleInternal(
                    bucket.BuyerOrganizationId, Common.WEEKLY_BUCKET_STORE_MANAGER_ROLE, cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                string? detail = (exception as BaseCustomException)?.Description;
                _logger.LogError($"Freeze reminder skipped: store managers could not be loaded. WeeklyBucketId: {bucket.Id}. Error: {exception.Message}{(detail != null ? $" | {detail}" : string.Empty)}");
                return 0;
            }

            List<IdentityUserDto> recipients = storeManagers
                .Where(x => !string.IsNullOrWhiteSpace(x.Email))
                .GroupBy(x => x.Email.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(x => x.First())
                .ToList();
            if (recipients.Count == 0)
            {
                _logger.LogInfo($"Freeze reminder: no store manager with an email. WeeklyBucketId: {bucket.Id}");
                return 0;
            }

            DateTime weekend = WeeklyBucketRules.WeekendStart(bucket.Year, bucket.WeekNumber, _configuration);
            int sent = 0;
            foreach (IdentityUserDto manager in recipients)
            {
                try
                {
                    await _metadataApiClient.SendEmailAsync(
                        manager.Email.Trim(),
                        Common.WEEKLY_BUCKET_REMINDER_EMAIL_KEY,
                        bucket.Id,
                        Common.WEEKLY_BUCKET_REF,
                        new Dictionary<string, string>
                        {
                            { "STORE_MANAGER_NAME", manager.Name ?? string.Empty },
                            { "BUCKET_CODE", bucket.BucketCode },
                            { "PLANT_CODE", bucket.PlantCode },
                            { "WEEKEND_DATE", weekend.ToString("dddd dd MMM yyyy") }
                        },
                        cancellationToken);
                    sent++;
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    string? detail = (exception as BaseCustomException)?.Description;
                    _logger.LogError($"Freeze reminder email failed. WeeklyBucketId: {bucket.Id}. Error: {exception.Message}{(detail != null ? $" | {detail}" : string.Empty)}");
                }
            }

            if (sent > 0)
            {
                WeeklyBucketRules.AddAudit(_repository, bucket.Id, null, Common.AUDIT_REMINDER_SENT, $"{today} Recipients={sent}");
                await _repository.SaveAsync();
            }

            _logger.LogInfo($"Freeze reminder sent. WeeklyBucketId: {bucket.Id}, Sent: {sent}, Recipients: {recipients.Count}");
            return sent;
        }
    }
}
