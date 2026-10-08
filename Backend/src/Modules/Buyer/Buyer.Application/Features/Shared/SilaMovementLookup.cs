using Microsoft.EntityFrameworkCore;
using Buyer.Application.Contracts;
using Buyer.Domain.Dto;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Display lookups of the stock movement screens (transfers, goods issues, adjustments): location names and user names.
    /// </summary>
    public static class SilaMovementLookup
    {
        public static async Task<Dictionary<Guid, string>> GetLocationNamesAsync(
            IRepositoryWrapper repository, Guid buyerId, IEnumerable<Guid> locationIds, CancellationToken cancellationToken)
        {
            List<Guid> ids = locationIds.Distinct().ToList();
            if (ids.Count == 0)
            {
                return new Dictionary<Guid, string>();
            }

            return await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.LocationName, cancellationToken);
        }

        /// <summary>
        /// Display names of the users from Identity. When Identity cannot be reached the names are left out, so the
        /// screen still loads and shows the user id instead.
        /// </summary>
        public static async Task<Dictionary<Guid, string>> GetUserNamesAsync(
            IIdentityApiClient identityApiClient, ILoggerManager logger, IEnumerable<Guid> userIds, CancellationToken cancellationToken)
        {
            List<Guid> ids = userIds.Where(x => x != Guid.Empty).Distinct().ToList();
            if (ids.Count == 0)
            {
                return new Dictionary<Guid, string>();
            }

            try
            {
                List<IdentityUserDto> users = await identityApiClient.GetUsersByIds(ids, cancellationToken);
                return users
                    .Where(x => !string.IsNullOrWhiteSpace(x.Name))
                    .GroupBy(x => x.UserId)
                    .ToDictionary(x => x.Key, x => x.First().Name);
            }
            catch (Exception exception)
            {
                logger.LogError($"User names could not be resolved from Identity. Users: {ids.Count}, Error: {SilaLogText.Short(exception.Message)}");
                return new Dictionary<Guid, string>();
            }
        }

        public static string NameOf(Dictionary<Guid, string> names, Guid userId)
        {
            return names.TryGetValue(userId, out string? name) ? name : userId.ToString();
        }
    }
}
