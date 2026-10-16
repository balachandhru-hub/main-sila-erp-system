using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Lookups and mapping shared by the SILA ME shortage enquiry use cases.</summary>
    public static class SilaEnquiryRules
    {
        public static readonly string[] JustificationCategories =
        {
            "BREAKAGE",
            "SPILLAGE",
            "UNRECORDED_CONSUMPTION",
            "UNRECORDED_TRANSFER",
            "COMPLIMENTARY_GUEST_RECOVERY",
            "INCORRECT_PREVIOUS_COUNT",
            "POS_RECIPE_MAPPING_ISSUE",
            "UOM_PACK_CONVERSION_ISSUE",
            "EXPIRED_OR_SPOILED",
            "THEFT_SUSPECTED_LOSS",
            "OTHER"
        };

        /// <summary>An enquiry of the buyer, tracked, after checking the user may work with its location.</summary>
        public static async Task<StockShortageEnquiry> GetEnquiryAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid userId, Guid roleId, Guid enquiryId, CancellationToken cancellationToken)
        {
            StockShortageEnquiry? enquiry = await repository.StockShortageEnquiry.FindFirstByConditionAsync(
                x => x.Id == enquiryId && x.BuyerId == buyerId && x.IsActive);
            if (enquiry == null)
            {
                logger.LogError($"Shortage enquiry not found. EnquiryId: {enquiryId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Enquiry not found.", "Open a shortage enquiry of this organization.");
            }

            await SilaAccess.EnsureLocationAccessAsync(repository, logger, buyerId, userId, roleId, enquiry.LocationId, cancellationToken);
            return enquiry;
        }

        public static async Task<List<SilaEnquiryDto>> MapAsync(
            IRepositoryWrapper repository, Guid buyerId, List<StockShortageEnquiry> enquiries, CancellationToken cancellationToken)
        {
            List<Guid> countIds = enquiries.Select(x => x.StockCountId).Distinct().ToList();
            List<Guid> itemIds = enquiries.Select(x => x.StockCountItemId).Distinct().ToList();
            List<Guid> locationIds = enquiries.Select(x => x.LocationId).Distinct().ToList();
            Dictionary<Guid, string> countNumbers = await repository.StockCount
                .FindByCondition(x => x.BuyerId == buyerId && countIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.CountNumber, cancellationToken);
            Dictionary<Guid, StockCountItem> lines = await repository.StockCountItem
                .FindByCondition(x => itemIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, string> locationNames = await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && locationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.LocationName, cancellationToken);
            Dictionary<Guid, Guid> managers = (await repository.InventoryLocationUserMapping
                    .FindByCondition(x => locationIds.Contains(x.LocationId) && x.IsActive)
                    .Select(x => new { x.LocationId, x.UserId })
                    .ToListAsync(cancellationToken))
                .GroupBy(x => x.LocationId)
                .ToDictionary(x => x.Key, x => x.First().UserId);

            return enquiries.Select(enquiry =>
            {
                lines.TryGetValue(enquiry.StockCountItemId, out StockCountItem? line);
                decimal? unitCost = line?.UnitCost;
                bool managerConfigured = managers.TryGetValue(enquiry.LocationId, out Guid managerId);
                return new SilaEnquiryDto
                {
                    Id = enquiry.Id,
                    EnquiryNumber = enquiry.EnquiryNumber,
                    StockCountId = enquiry.StockCountId,
                    CountNumber = countNumbers.TryGetValue(enquiry.StockCountId, out string? number) ? number : null,
                    StockCountItemId = enquiry.StockCountItemId,
                    MaterialId = enquiry.MaterialId,
                    MaterialCode = enquiry.MaterialCode,
                    MaterialName = enquiry.MaterialName,
                    LocationId = enquiry.LocationId,
                    LocationName = locationNames.TryGetValue(enquiry.LocationId, out string? name) ? name : null,
                    SystemQty = line?.SystemQty,
                    PhysicalQty = line?.CountedQty,
                    ShortageQty = enquiry.ShortageQty,
                    Uom = enquiry.Uom,
                    AssignedManagerUserId = managerConfigured ? managerId : null,
                    ManagerConfigured = managerConfigured,
                    ShortageValue = unitCost == null ? null : Math.Round(unitCost.Value * enquiry.ShortageQty, 4, MidpointRounding.AwayFromZero),
                    Status = enquiry.Status,
                    JustificationCategory = enquiry.JustificationCategory,
                    Response = enquiry.Response,
                    ReviewComment = enquiry.ReviewComment,
                    RespondedBy = enquiry.RespondedBy,
                    RespondedOn = enquiry.RespondedOn,
                    ReviewedBy = enquiry.ReviewedBy,
                    ReviewedOn = enquiry.ReviewedOn,
                    DateCreated = enquiry.DateCreated
                };
            }).ToList();
        }
    }
}
