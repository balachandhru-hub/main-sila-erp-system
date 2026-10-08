using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Inventory location rules shared by the location use cases: validating a location write (also for the Excel import) and building the response rows.
    /// </summary>
    public static class SilaLocationRules
    {
        public const string STATUS_ACTIVE = "ACTIVE";
        public const string STATUS_INACTIVE = "INACTIVE";
        public const string STATUS_ALL = "ALL";

        private static readonly string[] StoreCategories = { "BEVERAGE", "FOOD", "TOBACCO", "GENERAL" };

        private const int MAX_CODE = 40;
        private const int MAX_NAME = 200;
        private const int MAX_ACCOUNT = 40;

        /// <summary>The properties, outlets and locations of the buyer a location write is checked against.</summary>
        public static async Task<SilaLocationContext> LoadContextAsync(IRepositoryWrapper repository, Guid buyerId, CancellationToken cancellationToken)
        {
            return new SilaLocationContext
            {
                Properties = await repository.BuyerProperty
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                    .ToDictionaryAsync(x => x.Id, cancellationToken),
                Outlets = await repository.BuyerOutlet
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                    .ToListAsync(cancellationToken),
                Locations = await repository.InventoryLocation
                    .FindByCondition(x => x.BuyerId == buyerId)
                    .ToListAsync(cancellationToken)
            };
        }

        /// <summary>Checks a create/update request and normalizes its codes. Throws the first problem found.</summary>
        public static async Task ValidateAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            SilaLocationWriteDto request,
            Guid? currentLocationId,
            CancellationToken cancellationToken)
        {
            SilaLocationContext context = await LoadContextAsync(repository, buyerId, cancellationToken);
            SilaLocationIssue? issue = Check(request, currentLocationId, context);
            if (issue == null)
            {
                return;
            }

            logger.LogError($"Location write refused. LocationCode: {request.LocationCode}, Reason: {issue.Message}");
            if (issue.Kind == SilaLocationIssue.NOT_FOUND)
            {
                throw new NotFoundCustomException(issue.Message, issue.Description);
            }

            if (issue.Kind == SilaLocationIssue.CONFLICT)
            {
                throw new ConflictCustomException(issue.Message, issue.Description);
            }

            throw new BadRequestCustomException(issue.Message, issue.Description);
        }

        /// <summary>
        /// The rules of a location write, without database calls. A location belongs to a property of the buyer. A VENUE
        /// groups stores and outlets of its property and holds no stock (no transfers, no sales). A STORE or OUTLET may sit
        /// in a venue of the same property. An OUTLET points at an outlet of the same property (one location per outlet);
        /// a STORE has a store category; the location code is unique per buyer. Null when the write is valid.
        /// </summary>
        public static SilaLocationIssue? Check(SilaLocationWriteDto request, Guid? currentLocationId, SilaLocationContext context)
        {
            Normalize(request);
            if (string.IsNullOrWhiteSpace(request.LocationCode) || string.IsNullOrWhiteSpace(request.LocationName))
            {
                return SilaLocationIssue.Of(SilaLocationIssue.BAD_REQUEST, "Location code and name are required.", "Enter a location code and a location name.");
            }

            if (request.LocationCode.Length > MAX_CODE || request.LocationName.Length > MAX_NAME)
            {
                return SilaLocationIssue.Of(SilaLocationIssue.BAD_REQUEST, "Location code or name is too long.",
                    $"Use at most {MAX_CODE} characters for the code and {MAX_NAME} for the name.");
            }

            if (new[] { request.GlAccount, request.CostCenter, request.ProfitCenter, request.StorageLocationCode }.Any(x => x != null && x.Length > MAX_ACCOUNT))
            {
                return SilaLocationIssue.Of(SilaLocationIssue.BAD_REQUEST, "An account field is too long.",
                    $"Use at most {MAX_ACCOUNT} characters for the GL account, cost center, profit center and storage location.");
            }

            if (request.Description != null && request.Description.Trim().Length > SilaInputRules.COMMENT_LENGTH)
            {
                return SilaLocationIssue.Of(SilaLocationIssue.BAD_REQUEST, "Description is too long.",
                    $"Use at most {SilaInputRules.COMMENT_LENGTH} characters for the description.");
            }

            if (request.LocationType != Common.SILA_LOCATION_STORE
                && request.LocationType != Common.SILA_LOCATION_OUTLET
                && request.LocationType != Common.SILA_LOCATION_VENUE)
            {
                return SilaLocationIssue.Of(SilaLocationIssue.BAD_REQUEST, "Invalid location type.", "Select STORE, OUTLET or VENUE as the location type.");
            }

            if (!context.Properties.ContainsKey(request.PropertyId))
            {
                return SilaLocationIssue.Of(SilaLocationIssue.NOT_FOUND, "Property not found.", "Select a property that belongs to this buyer organization.");
            }

            InventoryLocation? current = currentLocationId == null ? null : context.Locations.FirstOrDefault(x => x.Id == currentLocationId);
            if (current != null
                && current.LocationType == Common.SILA_LOCATION_VENUE
                && (request.LocationType != Common.SILA_LOCATION_VENUE || request.PropertyId != current.PropertyId)
                && context.Locations.Any(x => x.IsActive && x.ParentLocationId == current.Id))
            {
                return SilaLocationIssue.Of(SilaLocationIssue.CONFLICT, "The venue has locations.",
                    "Move the stores and outlets of this venue to another venue before changing its type or property.");
            }

            SilaLocationIssue? typeIssue = request.LocationType switch
            {
                Common.SILA_LOCATION_VENUE => CheckVenue(request),
                Common.SILA_LOCATION_OUTLET => CheckOutlet(request, currentLocationId, context),
                _ => CheckStore(request)
            };
            if (typeIssue != null)
            {
                return typeIssue;
            }

            if (request.ParentLocationId != null)
            {
                InventoryLocation? parent = context.Locations.FirstOrDefault(x => x.Id == request.ParentLocationId && x.IsActive);
                if (parent == null || parent.LocationType != Common.SILA_LOCATION_VENUE || parent.Id == currentLocationId)
                {
                    return SilaLocationIssue.Of(SilaLocationIssue.BAD_REQUEST, "Parent venue not found.", "Select an active VENUE location as the parent, or no parent.");
                }

                if (parent.PropertyId != request.PropertyId)
                {
                    return SilaLocationIssue.Of(SilaLocationIssue.BAD_REQUEST, "Venue of another property.", "Select a venue of the same property as the location.");
                }
            }

            // The code stays unique also against deactivated locations (database unique index).
            string code = request.LocationCode;
            if (context.Locations.Any(x => x.LocationCode == code && x.Id != currentLocationId))
            {
                return SilaLocationIssue.Of(SilaLocationIssue.CONFLICT, "Location code already used.",
                    "Enter a location code that no other location of this organization uses.");
            }

            return null;
        }

        /// <summary>Copies a validated write onto the location.</summary>
        public static void Apply(InventoryLocation location, SilaLocationWriteDto request)
        {
            location.PropertyId = request.PropertyId;
            location.LocationCode = request.LocationCode;
            location.LocationName = request.LocationName;
            location.LocationType = request.LocationType;
            location.OutletId = request.OutletId;
            location.StoreCategory = request.StoreCategory;
            location.StorageLocationCode = request.StorageLocationCode;
            location.TransferEnabled = request.TransferEnabled;
            location.SalesEnabled = request.SalesEnabled;
            location.ParentLocationId = request.ParentLocationId;
            location.GlAccount = request.GlAccount;
            location.CostCenter = request.CostCenter;
            location.ProfitCenter = request.ProfitCenter;
            if (request.Description != null)
            {
                location.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
            }

            location.InventoryEnabled = request.InventoryEnabled ?? location.InventoryEnabled ?? true;
            location.ConsumptionEnabled = request.ConsumptionEnabled ?? location.ConsumptionEnabled ?? true;
        }

        /// <summary>The response rows of the locations, with property name, outlet name and user count.</summary>
        public static async Task<List<SilaLocationResponseDto>> ToResponseAsync(
            IRepositoryWrapper repository, Guid buyerId, List<InventoryLocation> locations, CancellationToken cancellationToken)
        {
            List<Guid> locationIds = locations.Select(x => x.Id).ToList();
            List<Guid> propertyIds = locations.Select(x => x.PropertyId).Distinct().ToList();
            List<Guid> outletIds = locations.Where(x => x.OutletId != null).Select(x => x.OutletId!.Value).Distinct().ToList();

            Dictionary<Guid, BuyerProperty> properties = await repository.BuyerProperty
                .FindByCondition(x => x.BuyerId == buyerId && propertyIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, string> propertyNames = properties.ToDictionary(x => x.Key, x => x.Value.PropertyName);
            Dictionary<Guid, string> outletNames = await repository.BuyerOutlet
                .FindByCondition(x => x.BuyerId == buyerId && outletIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.OutletName, cancellationToken);
            List<Guid> parentIds = locations.Where(x => x.ParentLocationId != null).Select(x => x.ParentLocationId!.Value).Distinct().ToList();
            Dictionary<Guid, string> parentNames = parentIds.Count == 0
                ? new Dictionary<Guid, string>()
                : await repository.InventoryLocation
                    .FindByCondition(x => x.BuyerId == buyerId && parentIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, x => x.LocationName, cancellationToken);
            List<Guid> mappedLocationIds = await repository.InventoryLocationUserMapping
                .FindByCondition(x => locationIds.Contains(x.LocationId) && x.IsActive)
                .Select(x => x.LocationId)
                .ToListAsync(cancellationToken);

            return locations
                .OrderBy(x => propertyNames.TryGetValue(x.PropertyId, out string? name) ? name : string.Empty)
                .ThenBy(x => x.LocationType)
                .ThenBy(x => x.LocationName)
                .Select(x => new SilaLocationResponseDto
                {
                    Id = x.Id,
                    LocationCode = x.LocationCode,
                    LocationName = x.LocationName,
                    LocationType = x.LocationType,
                    PropertyId = x.PropertyId,
                    PropertyName = propertyNames.TryGetValue(x.PropertyId, out string? propertyName) ? propertyName : string.Empty,
                    OutletId = x.OutletId,
                    OutletName = x.OutletId != null && outletNames.TryGetValue(x.OutletId.Value, out string? outletName) ? outletName : null,
                    StoreCategory = x.StoreCategory,
                    StorageLocationCode = x.StorageLocationCode,
                    TransferEnabled = x.TransferEnabled,
                    SalesEnabled = x.SalesEnabled,
                    ParentLocationId = x.ParentLocationId,
                    ParentLocationName = x.ParentLocationId != null && parentNames.TryGetValue(x.ParentLocationId.Value, out string? parentName) ? parentName : null,
                    GlAccount = x.GlAccount,
                    CostCenter = x.CostCenter,
                    ProfitCenter = x.ProfitCenter,
                    UserCount = mappedLocationIds.Count(id => id == x.Id),
                    Description = x.Description,
                    InventoryEnabled = x.InventoryEnabled ?? true,
                    ConsumptionEnabled = x.ConsumptionEnabled ?? true,
                    Status = x.IsActive ? STATUS_ACTIVE : STATUS_INACTIVE,
                    CompanyCode = properties.TryGetValue(x.PropertyId, out BuyerProperty? property) ? property.CompanyCode : null
                })
                .ToList();
        }

        /// <summary>An active Item Master material of the buyer, tracked. Not found is a 404.</summary>
        public static async Task<ItemBuyerMaster> GetMaterialAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid materialId)
        {
            ItemBuyerMaster? material = await repository.ItemBuyerMaster.FindFirstByConditionAsync(
                x => x.Id == materialId && x.BuyerId == buyerId && x.IsActive);
            if (material == null)
            {
                logger.LogError($"Material not found. MaterialId: {materialId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Material not found.", "Select an active Item Master material of this organization.");
            }

            return material;
        }

        private static void Normalize(SilaLocationWriteDto request)
        {
            request.LocationCode = (request.LocationCode ?? string.Empty).Trim().ToUpperInvariant();
            request.LocationName = (request.LocationName ?? string.Empty).Trim();
            request.LocationType = (request.LocationType ?? string.Empty).Trim().ToUpperInvariant();
            request.StoreCategory = string.IsNullOrWhiteSpace(request.StoreCategory) ? null : request.StoreCategory.Trim().ToUpperInvariant();
            request.StorageLocationCode = string.IsNullOrWhiteSpace(request.StorageLocationCode) ? null : request.StorageLocationCode.Trim();
            request.GlAccount = string.IsNullOrWhiteSpace(request.GlAccount) ? null : request.GlAccount.Trim();
            request.CostCenter = string.IsNullOrWhiteSpace(request.CostCenter) ? null : request.CostCenter.Trim();
            request.ProfitCenter = string.IsNullOrWhiteSpace(request.ProfitCenter) ? null : request.ProfitCenter.Trim();
            if (request.ParentLocationId == Guid.Empty)
            {
                request.ParentLocationId = null;
            }
        }

        private static SilaLocationIssue? CheckVenue(SilaLocationWriteDto request)
        {
            if (request.ParentLocationId != null)
            {
                return SilaLocationIssue.Of(SilaLocationIssue.BAD_REQUEST, "A venue has no parent location.", "A venue sits directly under its property; clear the parent.");
            }

            request.OutletId = null;
            request.StoreCategory = null;
            request.TransferEnabled = false;
            request.SalesEnabled = false;
            return null;
        }

        private static SilaLocationIssue? CheckStore(SilaLocationWriteDto request)
        {
            request.OutletId = null;
            if (request.StoreCategory == null || !StoreCategories.Contains(request.StoreCategory))
            {
                return SilaLocationIssue.Of(SilaLocationIssue.BAD_REQUEST, "Store category is required.",
                    "Select BEVERAGE, FOOD, TOBACCO or GENERAL as the store category.");
            }

            return null;
        }

        private static SilaLocationIssue? CheckOutlet(SilaLocationWriteDto request, Guid? currentLocationId, SilaLocationContext context)
        {
            request.StoreCategory = null;
            if (request.OutletId == null || request.OutletId == Guid.Empty)
            {
                return SilaLocationIssue.Of(SilaLocationIssue.BAD_REQUEST, "Outlet is required.", "Select the outlet this location stands for.");
            }

            BuyerOutlet? outlet = context.Outlets.FirstOrDefault(x => x.Id == request.OutletId);
            if (outlet == null || outlet.PropertyId != request.PropertyId)
            {
                return SilaLocationIssue.Of(SilaLocationIssue.BAD_REQUEST, "Outlet not in the property.", "Select an outlet of the selected property.");
            }

            if (context.Locations.Any(x => x.IsActive && x.OutletId == request.OutletId && x.Id != currentLocationId))
            {
                return SilaLocationIssue.Of(SilaLocationIssue.CONFLICT, "Outlet already has a location.",
                    "Each outlet can have one inventory location; edit the existing one.");
            }

            return null;
        }
    }
}
