using Microsoft.EntityFrameworkCore;
using Buyer.Application.Contracts;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Rules shared by the internal purchase request (PR) use cases.</summary>
    public static class SilaPurchaseRequestRules
    {
        public const string SOURCE_LIVE_INVENTORY = "LIVE_INVENTORY";
        public const string SOURCE_REPLENISHMENT = "REPLENISHMENT";
        public const string SOURCE_ALERT = "ALERT";
        public const string SOURCE_MANUAL = "MANUAL";

        public static readonly string[] Sources = { SOURCE_LIVE_INVENTORY, SOURCE_REPLENISHMENT, SOURCE_ALERT, SOURCE_MANUAL };

        public static readonly string[] Statuses = { Common.SILA_PR_SUBMITTED, Common.SILA_PR_ADDED_TO_BUCKET, Common.SILA_PR_CANCELLED };

        /// <summary>A purchase request of the buyer at a location the user may work with, tracked. Not found is a 404.</summary>
        public static async Task<InternalPurchaseRequest> GetAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid userId, Guid roleId, Guid requestId, CancellationToken cancellationToken)
        {
            InternalPurchaseRequest? purchaseRequest = await repository.InternalPurchaseRequest.FindFirstByConditionAsync(
                x => x.Id == requestId && x.BuyerId == buyerId && x.IsActive);
            if (purchaseRequest == null)
            {
                logger.LogError($"Purchase request not found. RequestId: {requestId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Purchase request not found.", "Open a purchase request of this organization.");
            }

            await SilaAccess.EnsureLocationAccessAsync(repository, logger, buyerId, userId, roleId, purchaseRequest.LocationId, cancellationToken);
            return purchaseRequest;
        }

        public static void EnsureSubmitted(ILoggerManager logger, InternalPurchaseRequest purchaseRequest, string action)
        {
            if (purchaseRequest.Status != Common.SILA_PR_SUBMITTED)
            {
                logger.LogError($"Purchase request is not open. RequestId: {purchaseRequest.Id}, Status: {purchaseRequest.Status}");
                throw new BadRequestCustomException(
                    $"The purchase request cannot be {action} in status {purchaseRequest.Status}.",
                    "Only submitted purchase requests can be changed; refresh the list.");
            }
        }

        public static async Task<string> NextNumberAsync(IRepositoryWrapper repository, Guid buyerId, CancellationToken cancellationToken)
        {
            return await DocumentNumber.NextAsync(repository, buyerId, DocumentNumber.PURCHASE_REQUEST, 6, cancellationToken);
        }

        /// <summary>The response rows with location, material, bucket and user names, looked up in batches.</summary>
        public static async Task<List<SilaPurchaseRequestDto>> ToDtosAsync(
            IRepositoryWrapper repository,
            IIdentityApiClient identityApiClient,
            ILoggerManager logger,
            Guid buyerId,
            List<InternalPurchaseRequest> rows,
            CancellationToken cancellationToken)
        {
            List<Guid> locationIds = rows.Select(x => x.LocationId).Distinct().ToList();
            List<Guid> materialIds = rows.Select(x => x.MaterialId).Distinct().ToList();
            List<Guid> bucketIds = rows.Where(x => x.WeeklyBucketId != null).Select(x => x.WeeklyBucketId!.Value).Distinct().ToList();

            Dictionary<Guid, InventoryLocation> locations = await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && locationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, ItemBuyerMaster> materials = await repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            HashSet<Guid> mapped = (await repository.CatalogMaterialMapping
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && materialIds.Contains(x.MaterialId))
                    .Select(x => x.MaterialId)
                    .ToListAsync(cancellationToken))
                .ToHashSet();
            Dictionary<Guid, string> buckets = bucketIds.Count == 0
                ? new Dictionary<Guid, string>()
                : await repository.WeeklyBucket
                    .FindByCondition(x => x.BuyerId == buyerId && bucketIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, x => x.BucketCode, cancellationToken);
            Dictionary<Guid, string> users = await SilaMovementLookup.GetUserNamesAsync(
                identityApiClient, logger, rows.Select(x => x.RequestedBy), cancellationToken);

            return rows.Select(x => new SilaPurchaseRequestDto
            {
                Id = x.Id,
                RequestNumber = x.RequestNumber,
                LocationId = x.LocationId,
                LocationName = locations.TryGetValue(x.LocationId, out InventoryLocation? location) ? location.LocationName : null,
                LocationType = location?.LocationType,
                MaterialId = x.MaterialId,
                MaterialCode = materials.TryGetValue(x.MaterialId, out ItemBuyerMaster? material) ? material.MaterialCode : null,
                MaterialName = material?.Description,
                Quantity = x.Quantity,
                Uom = x.Uom,
                Reason = x.Reason,
                Status = x.Status,
                Source = x.Source,
                RequestedBy = x.RequestedBy,
                RequestedByName = SilaMovementLookup.NameOf(users, x.RequestedBy),
                RequestedOn = x.DateCreated,
                WeeklyBucketId = x.WeeklyBucketId,
                WeeklyBucketCode = x.WeeklyBucketId != null && buckets.TryGetValue(x.WeeklyBucketId.Value, out string? code) ? code : null,
                CatalogMapped = mapped.Contains(x.MaterialId)
            }).ToList();
        }
    }
}
