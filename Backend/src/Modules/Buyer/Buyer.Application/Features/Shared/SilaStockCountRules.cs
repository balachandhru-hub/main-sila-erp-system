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
    /// Rules shared by the SILA ME stock count use cases: opening a count (also from an alert), loading a count,
    /// recording a counted quantity and mapping count lines (blind counts hide the system figures).
    /// </summary>
    public static class SilaStockCountRules
    {
        public const string COUNT_TYPE_MONTHLY = "MONTHLY";
        public const string COUNT_TYPE_PERIODIC = "PERIODIC";
        public const string COUNT_TYPE_ADHOC = "ADHOC";
        public const string METHOD_BARCODE = "BARCODE";
        public const string METHOD_SEARCH = "SEARCH";
        public const string METHOD_MANUAL = "MANUAL";
        public const string METHOD_PHOTO = "PHOTO";
        public const string EVENT_CREATED = "CREATED";
        public const string EVENT_SUBMITTED = "SUBMITTED";
        public const string EVENT_APPROVED = "APPROVED";
        public const string EVENT_CANCELLED = "CANCELLED";
        public const string EVENT_PHOTO_ADDED = "PHOTO_ADDED";
        public const string EVENT_REOPENED = "REOPENED";
        public const string REVIEW_ACCEPT = "ACCEPT";
        public const string REVIEW_RECOUNT = "RECOUNT";
        public const string REVIEW_MORE_INFORMATION = "MORE_INFORMATION";
        public const string REVIEW_REJECT = "REJECT";
        public const string LINE_REVIEW_ACCEPTED = "ACCEPTED";
        public const string LINE_REVIEW_REJECTED = "REJECTED";

        private static readonly string[] CountTypes = { COUNT_TYPE_MONTHLY, COUNT_TYPE_PERIODIC, Common.SILA_COUNT_SURPRISE, COUNT_TYPE_ADHOC };
        private static readonly string[] Methods = { METHOD_BARCODE, METHOD_SEARCH, METHOD_MANUAL, METHOD_PHOTO };

        /// <summary>
        /// Opens a count at the location with every material that has a balance or a stocking row there.
        /// Only one count may be in progress per location.
        /// </summary>
        public static async Task<StockCount> CreateCountAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            InventoryLedger ledger,
            Guid buyerId,
            Guid userId,
            Guid roleId,
            Guid locationId,
            string? countType,
            bool blindCount,
            string? notes,
            CancellationToken cancellationToken,
            DateTime? businessDate = null)
        {
            string type = (countType ?? string.Empty).Trim().ToUpperInvariant();
            if (!CountTypes.Contains(type))
            {
                logger.LogError($"Invalid stock count type. CountType: {countType}");
                throw new BadRequestCustomException("Count type is not valid.", "Use MONTHLY, PERIODIC, SURPRISE or ADHOC.");
            }

            SilaInputRules.MaxLength(logger, notes, SilaInputRules.COMMENT_LENGTH, "notes");

            SilaInputRules.SaneDate(logger, businessDate, "business date", 1, 1);

            InventoryLocation location = await SilaAccess.GetLocationAsync(repository, logger, buyerId, locationId);
            await SilaAccess.EnsureLocationAccessAsync(repository, logger, buyerId, userId, roleId, location.Id, cancellationToken);

            bool open = await repository.StockCount
                .FindByCondition(x => x.BuyerId == buyerId && x.LocationId == location.Id && x.IsActive && x.Status == Common.SILA_COUNT_IN_PROGRESS)
                .AnyAsync(cancellationToken);
            if (open)
            {
                logger.LogError($"A stock count is already in progress. LocationId: {location.Id}");
                throw new ConflictCustomException(
                    "A stock count is already in progress.",
                    $"Submit or cancel the open count of {location.LocationName} before starting a new one.");
            }

            List<InventoryBalance> balances = await repository.InventoryBalance
                .FindByCondition(x => x.BuyerId == buyerId && x.LocationId == location.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            List<Guid> stockedIds = await repository.InventoryLocationMaterial
                .FindByCondition(x => x.LocationId == location.Id && x.IsActive)
                .Select(x => x.MaterialId)
                .ToListAsync(cancellationToken);
            List<Guid> materialIds = balances.Select(x => x.MaterialId).Concat(stockedIds).Distinct().ToList();
            List<ItemBuyerMaster> materials = await repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && materialIds.Contains(x.Id))
                .ToListAsync(cancellationToken);

            StockCount count = new StockCount
            {
                Id = Guid.NewGuid(),
                BuyerId = buyerId,
                CountNumber = await DocumentNumber.NextAsync(repository, buyerId, DocumentNumber.STOCK_COUNT, 6, cancellationToken),
                LocationId = location.Id,
                CountType = type,
                BlindCount = blindCount,
                Status = Common.SILA_COUNT_IN_PROGRESS,
                Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
                BusinessDate = (businessDate ?? DateTime.UtcNow).Date,
                IsActive = true
            };
            repository.StockCount.Create(count);

            Dictionary<Guid, InventoryBalance> balancesByMaterial = balances
                .GroupBy(x => x.MaterialId)
                .ToDictionary(x => x.Key, x => x.First());
            foreach (ItemBuyerMaster material in materials.OrderBy(x => x.MaterialCode))
            {
                InventoryBalance? balance = balancesByMaterial.GetValueOrDefault(material.Id);
                repository.StockCountItem.Create(NewItem(count.Id, material, balance));
            }

            ledger.AddEvent(Common.SILA_REF_STOCK_COUNT, count.Id, EVENT_CREATED, $"{count.CountNumber} {location.LocationName} Items={materials.Count}");
            return count;
        }

        public static StockCountItem NewItem(Guid countId, ItemBuyerMaster material, InventoryBalance? balance)
        {
            return new StockCountItem
            {
                Id = Guid.NewGuid(),
                StockCountId = countId,
                MaterialId = material.Id,
                MaterialCode = material.MaterialCode ?? string.Empty,
                MaterialName = material.Description ?? string.Empty,
                BaseUom = balance?.BaseUom ?? UomConverter.BaseUomOf(material),
                SystemQty = balance?.OnHandQty ?? 0,
                UnitCost = balance?.UnitCost ?? material.UnitCost,
                Status = Common.SILA_COUNT_LINE_NOT_COUNTED,
                IsActive = true
            };
        }

        /// <summary>A count of the buyer, tracked, after checking the user may work with its location.</summary>
        public static async Task<StockCount> GetCountAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid userId, Guid roleId, Guid countId, CancellationToken cancellationToken)
        {
            StockCount? count = await repository.StockCount.FindFirstByConditionAsync(x => x.Id == countId && x.BuyerId == buyerId && x.IsActive);
            if (count == null)
            {
                logger.LogError($"Stock count not found. StockCountId: {countId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Stock count not found.", "Open a stock count of this organization.");
            }

            await SilaAccess.EnsureLocationAccessAsync(repository, logger, buyerId, userId, roleId, count.LocationId, cancellationToken);
            return count;
        }

        public static void EnsureInProgress(StockCount count, ILoggerManager logger)
        {
            if (count.Status != Common.SILA_COUNT_IN_PROGRESS)
            {
                logger.LogError($"Stock count is not in progress. StockCountId: {count.Id}, Status: {count.Status}");
                throw new BadRequestCustomException("Stock count is closed.", $"Count {count.CountNumber} is {count.Status}. Only a count in progress can be changed.");
            }
        }

        /// <summary>Blind counts hide the system quantity from counters until the count is submitted.</summary>
        public static bool CanSeeSystemQty(StockCount count, Guid roleId)
        {
            return !count.BlindCount || SilaAccess.HasFullAccess(roleId) || count.Status != Common.SILA_COUNT_IN_PROGRESS;
        }

        public static string NormalizeMethod(string? method)
        {
            string value = (method ?? string.Empty).Trim().ToUpperInvariant();
            return Methods.Contains(value) ? value : METHOD_MANUAL;
        }

        /// <summary>Records the counted base quantity and classifies the line. Inventory is not changed.</summary>
        public static void ApplyCount(StockCountItem item, decimal countedQty, string? method, Guid userId)
        {
            decimal counted = Math.Round(countedQty, 4, MidpointRounding.AwayFromZero);
            decimal variance = Math.Round(counted - item.SystemQty, 4, MidpointRounding.AwayFromZero);
            item.CountedQty = counted;
            item.VarianceQty = variance;
            item.VarianceValue = item.UnitCost == null ? null : Math.Round(variance * item.UnitCost.Value, 4, MidpointRounding.AwayFromZero);
            item.CountMethod = method;
            item.Status = variance < 0 ? Common.SILA_COUNT_LINE_SHORTAGE : variance > 0 ? Common.SILA_COUNT_LINE_SURPLUS : Common.SILA_COUNT_LINE_MATCHED;
            item.CountedBy = userId;
            item.CountedOn = DateTime.UtcNow;
        }

        /// <summary>A submitted count sent back for recount: only the lines marked for recount may be counted.</summary>
        public static bool IsReopened(StockCount count)
        {
            return count.Status == Common.SILA_COUNT_IN_PROGRESS && count.SubmittedOn != null;
        }

        /// <summary>Clears the counted figures so the counter counts the line again.</summary>
        public static void ResetForRecount(StockCountItem item, string comment)
        {
            item.CountedQty = null;
            item.VarianceQty = null;
            item.VarianceValue = null;
            item.CountMethod = null;
            item.CountedBy = null;
            item.CountedOn = null;
            item.Status = Common.SILA_COUNT_LINE_NOT_COUNTED;
            item.RecountRequested = true;
            item.ReviewStatus = null;
            item.ReviewComment = comment;
        }

        public static List<string> UomsOf(Guid materialId, string baseUom, Dictionary<Guid, List<MaterialUomConversion>> conversions)
        {
            List<string> uoms = new List<string> { baseUom };
            if (conversions.TryGetValue(materialId, out List<MaterialUomConversion>? list))
            {
                uoms.AddRange(list.SelectMany(x => new[] { x.FromUom, x.ToUom }).Select(x => x.Trim().ToUpperInvariant()));
            }

            return uoms.Distinct().ToList();
        }

        public static SilaStockCountItemDto MapItem(
            StockCountItem item, bool canSeeSystemQty, string? barcode, Dictionary<Guid, List<MaterialUomConversion>> conversions)
        {
            return new SilaStockCountItemDto
            {
                Id = item.Id,
                MaterialId = item.MaterialId,
                MaterialCode = item.MaterialCode,
                MaterialName = item.MaterialName,
                Barcode = barcode,
                BaseUom = item.BaseUom,
                Uoms = UomsOf(item.MaterialId, item.BaseUom, conversions),
                SystemQty = canSeeSystemQty ? item.SystemQty : null,
                CountedQty = item.CountedQty,
                VarianceQty = canSeeSystemQty ? item.VarianceQty : null,
                UnitCost = item.UnitCost,
                VarianceValue = canSeeSystemQty ? item.VarianceValue : null,
                CountMethod = item.CountMethod,
                Status = canSeeSystemQty || item.Status == Common.SILA_COUNT_LINE_NOT_COUNTED ? item.Status : "COUNTED",
                CountedBy = item.CountedBy,
                CountedOn = item.CountedOn,
                RecountRequested = item.RecountRequested,
                ReviewStatus = item.ReviewStatus,
                ReviewComment = item.ReviewComment
            };
        }

        /// <summary>The "saved" message the counter sees after each line.</summary>
        public static string SavedMessage(StockCountItem item, bool canSeeSystemQty)
        {
            if (!canSeeSystemQty)
            {
                return $"Saved {item.CountedQty:0.####} {item.BaseUom}. Inventory was not changed.";
            }

            return $"Saved. Variance {item.VarianceQty:+0.####;-0.####;0} {item.BaseUom} ({item.Status}). Inventory was not changed.";
        }
    }
}
