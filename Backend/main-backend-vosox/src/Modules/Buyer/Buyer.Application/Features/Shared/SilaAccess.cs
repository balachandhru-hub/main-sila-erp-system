using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The lookups every SILA ME use case starts with: the signed-in buyer, and the inventory locations the user may work with.
    /// The buyer administrator, the store manager and the cost controller see every location of the buyer; other users see the locations they
    /// are assigned to and the outlet locations of their outlets.
    /// </summary>
    public static class SilaAccess
    {
        public static async Task<BuyerBusinessProfile> GetBuyerAsync(IRepositoryWrapper repository, ILoggerManager logger, Guid organizationId)
        {
            BuyerBusinessProfile? buyer = await repository.BuyerBusinessProfile.FindFirstByConditionAsync(
                x => x.OrganizationId == organizationId && x.IsActive);
            if (buyer == null)
            {
                logger.LogError($"Buyer not found. OrganizationId: {organizationId}");
                throw new NotFoundCustomException("Buyer not found.", "The signed-in organization does not have a buyer profile.");
            }

            return buyer;
        }

        public static bool HasFullAccess(Guid roleId)
        {
            return roleId == Common.BUYER_ADMIN_ROLE_ID || roleId == Common.STORE_MANAGER_ROLE_ID || roleId == Common.COST_CONTROLLER_ROLE_ID;
        }

        /// <summary>The ids of the active locations the user may work with.</summary>
        public static async Task<List<Guid>> GetLocationIdsAsync(
            IRepositoryWrapper repository, Guid buyerId, Guid userId, Guid roleId, CancellationToken cancellationToken)
        {
            IQueryable<InventoryLocation> locations = repository.InventoryLocation.FindByCondition(x => x.BuyerId == buyerId && x.IsActive);
            if (HasFullAccess(roleId))
            {
                return await locations.Select(x => x.Id).ToListAsync(cancellationToken);
            }

            List<Guid> assigned = await repository.InventoryLocationUserMapping
                .FindByCondition(x => x.UserId == userId && x.IsActive)
                .Select(x => x.LocationId)
                .ToListAsync(cancellationToken);
            List<Guid> outletIds = await repository.BuyerOutletUserMapping
                .FindByCondition(x => x.UserId == userId && x.IsActive)
                .Select(x => x.OutletId)
                .ToListAsync(cancellationToken);

            return await locations
                .Where(x => assigned.Contains(x.Id) || (x.OutletId != null && outletIds.Contains(x.OutletId.Value)))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
        }

        /// <summary>An active location of the buyer, tracked. Not found is a 404.</summary>
        public static async Task<InventoryLocation> GetLocationAsync(IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid locationId)
        {
            InventoryLocation? location = await repository.InventoryLocation.FindFirstByConditionAsync(
                x => x.Id == locationId && x.BuyerId == buyerId && x.IsActive);
            if (location == null)
            {
                logger.LogError($"Inventory location not found. LocationId: {locationId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Location not found.", "Select an active inventory location of this organization.");
            }

            return location;
        }

        /// <summary>Throws 403 when the user may not work with the location.</summary>
        public static async Task EnsureLocationAccessAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid userId, Guid roleId, Guid locationId, CancellationToken cancellationToken)
        {
            if (HasFullAccess(roleId))
            {
                return;
            }

            List<Guid> allowed = await GetLocationIdsAsync(repository, buyerId, userId, roleId, cancellationToken);
            if (!allowed.Contains(locationId))
            {
                logger.LogError($"User has no access to the location. UserId: {userId}, LocationId: {locationId}");
                throw new ForBiddenCustomException("No access to this location.", "Ask your administrator to assign you to the location.");
            }
        }

        /// <summary>Active Item Master materials of the buyer by id. A missing id is a 404.</summary>
        public static async Task<Dictionary<Guid, ItemBuyerMaster>> GetMaterialsAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, IEnumerable<Guid> materialIds, CancellationToken cancellationToken)
        {
            List<Guid> ids = materialIds.Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = await repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && ids.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Guid missing = ids.FirstOrDefault(id => !materials.ContainsKey(id));
            if (missing != Guid.Empty)
            {
                logger.LogError($"Material not found. MaterialId: {missing}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Material not found.", "Select an active Item Master material of this organization.");
            }

            return materials;
        }
    }
}
