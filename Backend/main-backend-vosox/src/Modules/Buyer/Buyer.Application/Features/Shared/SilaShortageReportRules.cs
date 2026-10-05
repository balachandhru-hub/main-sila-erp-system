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
    /// <summary>
    /// Builds the shortage report (screen, Excel and PDF use the same data): every SHORTAGE line of the counts submitted in
    /// the period, with its enquiry and the cost controller review, totalled by location and by justification category.
    /// </summary>
    public static class SilaShortageReportRules
    {
        public const string NOT_JUSTIFIED = "NOT_JUSTIFIED";

        /// <summary>SAP status filter value of lines that have no ERP posting.</summary>
        public const string NOT_POSTED = "NOT_POSTED";
        public const int DEFAULT_DAYS = 30;
        public const int MAX_DAYS = 366;
        public const int MAX_LINES = 20000;

        private static readonly string[] CountStatuses = { Common.SILA_COUNT_SUBMITTED, Common.SILA_COUNT_ENQUIRY_PENDING, Common.SILA_COUNT_POSTED };
        private static readonly string[] EnquiryStatuses =
        {
            Common.SILA_ENQUIRY_SENT, Common.SILA_ENQUIRY_RESPONDED, Common.SILA_ENQUIRY_MORE_INFORMATION, Common.SILA_ENQUIRY_ACCEPTED, Common.SILA_ENQUIRY_REJECTED
        };

        /// <summary>Validated period: defaults to the last 30 days, at most 366 days.</summary>
        public static (DateTime From, DateTime To) Period(ILoggerManager logger, SilaShortageReportFilterDto filter)
        {
            DateTime to = (filter.To ?? DateTime.UtcNow).Date;
            DateTime from = (filter.From ?? to.AddDays(-DEFAULT_DAYS)).Date;
            if (from > to)
            {
                logger.LogError($"Shortage report period is reversed. From: {from:yyyy-MM-dd}, To: {to:yyyy-MM-dd}");
                throw new BadRequestCustomException("Period is not valid.", "The From date must be on or before the To date.");
            }

            if ((to - from).TotalDays > MAX_DAYS)
            {
                logger.LogError($"Shortage report period too long. From: {from:yyyy-MM-dd}, To: {to:yyyy-MM-dd}");
                throw new BadRequestCustomException("Period is too long.", $"Choose a period of at most {MAX_DAYS} days.");
            }

            return (from, to);
        }

        public static async Task<List<SilaShortageLineDto>> LoadLinesAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            Guid userId,
            Guid roleId,
            SilaShortageReportFilterDto filter,
            DateTime from,
            DateTime to,
            CancellationToken cancellationToken,
            IIdentityApiClient? identityApiClient = null)
        {
            string? category = string.IsNullOrWhiteSpace(filter.Category) ? null : filter.Category.Trim().ToUpperInvariant();
            if (category != null && category != NOT_JUSTIFIED && !SilaEnquiryRules.JustificationCategories.Contains(category))
            {
                logger.LogError($"Invalid shortage report category. Category: {filter.Category}");
                throw new BadRequestCustomException("Category is not valid.", "Choose a justification category from the list.");
            }

            string? enquiryStatus = string.IsNullOrWhiteSpace(filter.EnquiryStatus) ? null : filter.EnquiryStatus.Trim().ToUpperInvariant();
            if (enquiryStatus != null && !EnquiryStatuses.Contains(enquiryStatus))
            {
                logger.LogError($"Invalid shortage report enquiry status. Status: {filter.EnquiryStatus}");
                throw new BadRequestCustomException("Enquiry status is not valid.", "Choose an enquiry status from the list.");
            }

            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(repository, buyerId, userId, roleId, cancellationToken);
            if (filter.LocationId != null)
            {
                InventoryLocation location = await SilaAccess.GetLocationAsync(repository, logger, buyerId, filter.LocationId.Value);
                await SilaAccess.EnsureLocationAccessAsync(repository, logger, buyerId, userId, roleId, location.Id, cancellationToken);
                locationIds = new List<Guid> { location.Id };
            }

            DateTime toExclusive = to.AddDays(1);
            List<StockCount> counts = await repository.StockCount
                .FindByCondition(x => x.BuyerId == buyerId
                    && x.IsActive
                    && CountStatuses.Contains(x.Status)
                    && x.SubmittedOn != null
                    && x.SubmittedOn >= from
                    && x.SubmittedOn < toExclusive
                    && locationIds.Contains(x.LocationId))
                .ToListAsync(cancellationToken);
            List<Guid> countIds = counts.Select(x => x.Id).ToList();
            IQueryable<StockCountItem> itemQuery = repository.StockCountItem
                .FindByCondition(x => countIds.Contains(x.StockCountId) && x.IsActive && x.Status == Common.SILA_COUNT_LINE_SHORTAGE);
            int lineCount = await itemQuery.CountAsync(cancellationToken);
            if (lineCount > MAX_LINES)
            {
                logger.LogError($"Shortage report too large. Lines: {lineCount}");
                throw new BadRequestCustomException("Too many shortage lines.", $"The period has {lineCount} lines. Choose a shorter period or one location.");
            }

            List<StockCountItem> items = await itemQuery.ToListAsync(cancellationToken);
            Dictionary<Guid, StockShortageEnquiry> enquiries = (await repository.StockShortageEnquiry
                    .FindByCondition(x => x.BuyerId == buyerId && countIds.Contains(x.StockCountId) && x.IsActive)
                    .ToListAsync(cancellationToken))
                .GroupBy(x => x.StockCountItemId)
                .ToDictionary(x => x.Key, x => x.OrderByDescending(e => e.DateCreated).First());
            List<Guid> usedLocationIds = counts.Select(x => x.LocationId).Distinct().ToList();
            SilaCountContext context = await SilaCountContext.LoadAsync(
                repository, identityApiClient, logger, buyerId, usedLocationIds, Array.Empty<Guid>(), cancellationToken);
            Dictionary<Guid, string> locationNames = context.Locations.ToDictionary(x => x.Key, x => x.Value.LocationName);
            Dictionary<Guid, InventoryErpPosting> postings = await SilaCountPosting.GetPostingsAsync(repository, buyerId, countIds, cancellationToken);
            string? sapStatus = string.IsNullOrWhiteSpace(filter.SapStatus) ? null : filter.SapStatus.Trim().ToUpperInvariant();
            Dictionary<Guid, StockCount> countById = counts.ToDictionary(x => x.Id);

            List<SilaShortageLineDto> lines = new List<SilaShortageLineDto>();
            foreach (StockCountItem item in items)
            {
                StockCount count = countById[item.StockCountId];
                StockShortageEnquiry? enquiry = enquiries.TryGetValue(item.Id, out StockShortageEnquiry? found) ? found : null;
                SilaShortageLineDto line = MapLine(count, item, enquiry, locationNames);
                line.PropertyName = context.PropertyOf(count.LocationId);
                line.Manager = context.ManagerOf(count.LocationId);
                if (line.Posted && postings.TryGetValue(count.Id, out InventoryErpPosting? posting))
                {
                    line.SapStatus = posting.Status;
                    line.SapMaterialDocument = posting.ErpReference;
                    line.SapError = posting.Status == Common.SILA_POSTING_FAILED ? posting.ErrorMessage : null;
                }

                if (sapStatus != null && (line.SapStatus ?? NOT_POSTED) != sapStatus)
                {
                    continue;
                }

                if (category != null && (line.JustificationCategory ?? NOT_JUSTIFIED) != category)
                {
                    continue;
                }

                if (enquiryStatus != null && line.EnquiryStatus != enquiryStatus)
                {
                    continue;
                }

                lines.Add(line);
            }

            return lines
                .OrderByDescending(x => x.SubmittedOn)
                .ThenBy(x => x.CountNumber)
                .ThenBy(x => x.MaterialCode)
                .ToList();
        }

        public static bool IsAccepted(SilaShortageLineDto line)
        {
            return line.ReviewStatus == SilaStockCountRules.LINE_REVIEW_ACCEPTED || line.EnquiryStatus == Common.SILA_ENQUIRY_ACCEPTED;
        }

        public static bool IsRejected(SilaShortageLineDto line)
        {
            return line.ReviewStatus == SilaStockCountRules.LINE_REVIEW_REJECTED || line.EnquiryStatus == Common.SILA_ENQUIRY_REJECTED;
        }

        private static SilaShortageLineDto MapLine(
            StockCount count, StockCountItem item, StockShortageEnquiry? enquiry, Dictionary<Guid, string> locationNames)
        {
            SilaShortageLineDto line = new SilaShortageLineDto
            {
                StockCountId = count.Id,
                CountNumber = count.CountNumber,
                CountType = count.CountType,
                CountStatus = count.Status,
                LocationId = count.LocationId,
                LocationName = locationNames.TryGetValue(count.LocationId, out string? name) ? name : null,
                SubmittedOn = count.SubmittedOn,
                ApprovedOn = count.ApprovedOn,
                StockCountItemId = item.Id,
                MaterialId = item.MaterialId,
                MaterialCode = item.MaterialCode,
                MaterialName = item.MaterialName,
                Uom = item.BaseUom,
                SystemQty = item.SystemQty,
                CountedQty = item.CountedQty,
                ShortageQty = -(item.VarianceQty ?? 0),
                UnitCost = item.UnitCost,
                ShortageValue = -(item.VarianceValue ?? 0),
                EnquiryId = enquiry?.Id,
                EnquiryNumber = enquiry?.EnquiryNumber,
                EnquiryStatus = enquiry?.Status,
                JustificationCategory = enquiry?.JustificationCategory,
                Response = enquiry?.Response,
                ReviewStatus = item.ReviewStatus,
                ReviewComment = item.ReviewComment ?? enquiry?.ReviewComment
            };
            line.Posted = count.Status == Common.SILA_COUNT_POSTED && !IsRejected(line);
            return line;
        }
    }
}
