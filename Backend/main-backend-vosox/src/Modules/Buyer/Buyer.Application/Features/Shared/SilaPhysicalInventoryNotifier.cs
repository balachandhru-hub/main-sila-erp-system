using Buyer.Application.Contracts;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Entities;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Emails the schedule of a physical inventory to every cost controller and buyer administrator of the organization
    /// (MasterData email key SILA_PHYSICAL_INVENTORY_SCHEDULED). Failures are logged and never fail the request.
    /// </summary>
    public static class SilaPhysicalInventoryNotifier
    {
        public const string EMAIL_KEY = "SILA_PHYSICAL_INVENTORY_SCHEDULED";

        public static async Task<int> NotifyAsync(
            IIdentityApiClient identityApiClient,
            IMetadataApiClient metadataApiClient,
            ILoggerManager logger,
            Guid organizationId,
            PhysicalInventoryRequest request,
            string locationName,
            CancellationToken cancellationToken)
        {
            List<IdentityUserDto> users;
            try
            {
                users = await identityApiClient.GetOrganizationUsers(organizationId, cancellationToken, includeAdministrators: true);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                string? detail = (exception as BaseCustomException)?.Description;
                logger.LogError(
                    $"Physical inventory email skipped: organization users could not be loaded. RequestId: {request.Id}. Error: {exception.Message}{(detail != null ? $" | {detail}" : string.Empty)}");
                return 0;
            }

            List<string> recipients = users
                .Where(x => (x.RoleId == Common.COST_CONTROLLER_ROLE_ID || x.RoleId == Common.BUYER_ADMIN_ROLE_ID) && !string.IsNullOrWhiteSpace(x.Email))
                .Select(x => x.Email.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (recipients.Count == 0)
            {
                logger.LogInfo($"Physical inventory email: no cost controller or buyer administrator found. RequestId: {request.Id}");
                return 0;
            }

            Dictionary<string, string> parameters = new Dictionary<string, string>
            {
                { "LOCATION_NAME", locationName },
                { "SCHEDULED_DATE", request.ScheduledDate.ToString("dddd dd MMM yyyy") },
                { "REASON", request.Reason },
                { "REQUEST_NUMBER", request.RequestNumber }
            };

            int sent = 0;
            foreach (string email in recipients)
            {
                try
                {
                    await metadataApiClient.SendEmailAsync(email, EMAIL_KEY, request.Id, Common.SILA_REF_PHYSICAL_INVENTORY, parameters, cancellationToken);
                    sent++;
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    string? detail = (exception as BaseCustomException)?.Description;
                    logger.LogError(
                        $"Physical inventory email failed. RequestId: {request.Id}. Error: {exception.Message}{(detail != null ? $" | {detail}" : string.Empty)}");
                }
            }

            logger.LogInfo($"Physical inventory emails sent. RequestId: {request.Id}, Sent: {sent}, Recipients: {recipients.Count}");
            return sent;
        }
    }
}
