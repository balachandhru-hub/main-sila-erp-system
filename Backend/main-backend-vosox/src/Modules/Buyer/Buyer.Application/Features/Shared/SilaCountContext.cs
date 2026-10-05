using Microsoft.EntityFrameworkCore;
using Buyer.Application.Contracts;
using Buyer.Domain.Dto;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Display context of stock count screens and the shortage report: the property of each location, user names and
    /// the location managers (users assigned to the location whose role is a manager role). Loaded with one query per
    /// table and one Identity call (skipped when no Identity client is given: names and managers stay empty).
    /// </summary>
    public class SilaCountContext
    {
        public Dictionary<Guid, InventoryLocation> Locations { get; } = new();
        public Dictionary<Guid, string> PropertyNames { get; } = new();
        public Dictionary<Guid, IdentityUserDto> Users { get; } = new();
        public Dictionary<Guid, string> Managers { get; } = new();

        public string? PropertyOf(Guid locationId)
        {
            return Locations.TryGetValue(locationId, out InventoryLocation? location)
                && PropertyNames.TryGetValue(location.PropertyId, out string? name) ? name : null;
        }

        public Guid? PropertyIdOf(Guid locationId)
        {
            return Locations.TryGetValue(locationId, out InventoryLocation? location) ? location.PropertyId : null;
        }

        public string? NameOf(Guid? userId)
        {
            if (userId == null || userId == Guid.Empty)
            {
                return null;
            }

            return Users.TryGetValue(userId.Value, out IdentityUserDto? user) && !string.IsNullOrWhiteSpace(user.Name)
                ? user.Name
                : userId.Value.ToString();
        }

        public string? ManagerOf(Guid locationId)
        {
            return Managers.TryGetValue(locationId, out string? manager) ? manager : null;
        }

        /// <summary>The one currency of the materials (all of the buyer when none are given), or null when they differ.</summary>
        public static async Task<string?> CurrencyAsync(
            IRepositoryWrapper repository, Guid buyerId, ICollection<Guid>? materialIds, CancellationToken cancellationToken)
        {
            IQueryable<ItemBuyerMaster> query = repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && x.Currency != null && x.Currency != string.Empty);
            if (materialIds != null)
            {
                query = query.Where(x => materialIds.Contains(x.Id));
            }

            List<string?> currencies = await query.Select(x => x.Currency).Distinct().Take(2).ToListAsync(cancellationToken);
            return currencies.Count == 1 ? currencies[0] : null;
        }

        public static async Task<SilaCountContext> LoadAsync(
            IRepositoryWrapper repository,
            IIdentityApiClient? identityApiClient,
            ILoggerManager logger,
            Guid buyerId,
            IEnumerable<Guid> locationIds,
            IEnumerable<Guid> userIds,
            CancellationToken cancellationToken)
        {
            SilaCountContext context = new SilaCountContext();
            List<Guid> ids = locationIds.Distinct().ToList();
            List<InventoryLocation> locations = await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                .ToListAsync(cancellationToken);
            foreach (InventoryLocation location in locations)
            {
                context.Locations[location.Id] = location;
            }

            List<Guid> propertyIds = locations.Select(x => x.PropertyId).Distinct().ToList();
            Dictionary<Guid, string> properties = await repository.BuyerProperty
                .FindByCondition(x => x.BuyerId == buyerId && propertyIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.PropertyName, cancellationToken);
            foreach (KeyValuePair<Guid, string> property in properties)
            {
                context.PropertyNames[property.Key] = property.Value;
            }

            if (identityApiClient == null)
            {
                return context;
            }

            List<InventoryLocationUserMapping> mappings = await repository.InventoryLocationUserMapping
                .FindByCondition(x => ids.Contains(x.LocationId) && x.IsActive)
                .ToListAsync(cancellationToken);
            List<Guid> allUserIds = userIds.Concat(mappings.Select(x => x.UserId)).Where(x => x != Guid.Empty).Distinct().ToList();
            if (allUserIds.Count == 0)
            {
                return context;
            }

            try
            {
                List<IdentityUserDto> users = await identityApiClient.GetUsersByIds(allUserIds, cancellationToken);
                foreach (IdentityUserDto user in users.GroupBy(x => x.UserId).Select(x => x.First()))
                {
                    context.Users[user.UserId] = user;
                }
            }
            catch (Exception exception)
            {
                logger.LogError($"Users could not be resolved from Identity. Users: {allUserIds.Count}, Error: {SilaLogText.Short(exception.Message)}");
                return context;
            }

            foreach (IGrouping<Guid, InventoryLocationUserMapping> group in mappings.GroupBy(x => x.LocationId))
            {
                List<string> managers = group
                    .Select(x => context.Users.TryGetValue(x.UserId, out IdentityUserDto? user) ? user : null)
                    .Where(x => x != null && (x.RoleName ?? string.Empty).ToUpperInvariant().Contains("MANAGER") && !string.IsNullOrWhiteSpace(x.Name))
                    .Select(x => x!.Name)
                    .Distinct()
                    .OrderBy(x => x)
                    .ToList();
                if (managers.Count > 0)
                {
                    context.Managers[group.Key] = string.Join(", ", managers);
                }
            }

            return context;
        }
    }
}
