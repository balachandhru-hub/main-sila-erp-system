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
    /// Physical inventory requests (PI000001): a surprise blind count scheduled on a random working day within the next
    /// 7 days (or a given date). The PhysicalInventoryJob opens the count on the day; approving the count completes the request.
    /// </summary>
    public static class SilaPhysicalInventoryRules
    {
        public const string EVENT_REQUESTED = "REQUESTED";
        public const string EVENT_RESCHEDULED = "RESCHEDULED";
        public const string EVENT_STARTED = "COUNT_STARTED";
        public const string EVENT_CANCELLED = "CANCELLED";
        public const int RANDOM_DAYS = 7;
        public const int MAX_DAYS_AHEAD = 90;
        public const int MAX_REASON_LENGTH = 500;

        private static readonly string[] OpenStatuses = { Common.SILA_PI_SCHEDULED, Common.SILA_PI_IN_PROGRESS };

        /// <summary>A random Monday–Friday from tomorrow up to 7 days ahead.</summary>
        public static DateTime RandomWorkingDay(DateTime today)
        {
            List<DateTime> days = Enumerable.Range(1, RANDOM_DAYS)
                .Select(offset => today.Date.AddDays(offset))
                .Where(day => day.DayOfWeek != DayOfWeek.Saturday && day.DayOfWeek != DayOfWeek.Sunday)
                .ToList();
            return days[Random.Shared.Next(days.Count)];
        }

        /// <summary>The given date (today up to 90 days ahead) or a random working day.</summary>
        public static DateTime ResolveDate(ILoggerManager logger, DateTime? requested)
        {
            DateTime today = DateTime.UtcNow.Date;
            if (requested == null)
            {
                return RandomWorkingDay(today);
            }

            DateTime date = requested.Value.Date;
            if (date < today || date > today.AddDays(MAX_DAYS_AHEAD))
            {
                logger.LogError($"Physical inventory date out of range. Date: {date:yyyy-MM-dd}");
                throw new BadRequestCustomException("Date is not valid.", $"Choose a date from today up to {MAX_DAYS_AHEAD} days ahead, or leave it empty for a random working day.");
            }

            return date;
        }

        public static string ValidateReason(ILoggerManager logger, string? reason)
        {
            string value = (reason ?? string.Empty).Trim();
            if (value.Length == 0)
            {
                logger.LogError("Physical inventory reason is empty.");
                throw new BadRequestCustomException("Reason is required.", "Say why the physical inventory is needed, e.g. negative stock of a material.");
            }

            if (value.Length > MAX_REASON_LENGTH)
            {
                logger.LogError($"Physical inventory reason too long. Length: {value.Length}");
                throw new BadRequestCustomException("Reason is too long.", $"Keep the reason within {MAX_REASON_LENGTH} characters.");
            }

            return value;
        }

        /// <summary>Creates the request after checking no other request is open at the location.</summary>
        public static async Task<PhysicalInventoryRequest> CreateAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            InventoryLedger ledger,
            Guid buyerId,
            Guid userId,
            InventoryLocation location,
            Guid? alertId,
            string reason,
            DateTime scheduledDate,
            Guid? assignedUserId,
            CancellationToken cancellationToken)
        {
            PhysicalInventoryRequest? open = await repository.PhysicalInventoryRequest
                .FindByCondition(x => x.BuyerId == buyerId && x.LocationId == location.Id && x.IsActive && OpenStatuses.Contains(x.Status))
                .FirstOrDefaultAsync(cancellationToken);
            if (open != null)
            {
                logger.LogError($"Physical inventory already open. LocationId: {location.Id}, RequestId: {open.Id}");
                throw new ConflictCustomException(
                    "A physical inventory is already planned.",
                    $"{open.RequestNumber} for {location.LocationName} is {open.Status} (scheduled {open.ScheduledDate:dd MMM yyyy}). Reschedule or cancel it instead.");
            }

            PhysicalInventoryRequest request = new PhysicalInventoryRequest
            {
                Id = Guid.NewGuid(),
                BuyerId = buyerId,
                RequestNumber = await DocumentNumber.NextAsync(repository, buyerId, DocumentNumber.PHYSICAL_INVENTORY, 6, cancellationToken),
                LocationId = location.Id,
                AlertId = alertId,
                Reason = reason,
                ScheduledDate = scheduledDate,
                Status = Common.SILA_PI_SCHEDULED,
                RequestedBy = userId,
                AssignedUserId = assignedUserId,
                IsActive = true
            };
            repository.PhysicalInventoryRequest.Create(request);
            ledger.AddEvent(Common.SILA_REF_PHYSICAL_INVENTORY, request.Id, EVENT_REQUESTED,
                $"{request.RequestNumber} {location.LocationName} on {scheduledDate:yyyy-MM-dd}: {reason}");
            return request;
        }

        /// <summary>
        /// Opens the surprise blind count of a due request. Returns false (nothing changed) while another count is in
        /// progress at the location; the job tries again on its next run.
        /// </summary>
        public static async Task<bool> StartCountAsync(
            IRepositoryWrapper repository, ILoggerManager logger, InventoryLedger ledger, PhysicalInventoryRequest request, CancellationToken cancellationToken)
        {
            bool busy = await repository.StockCount
                .FindByCondition(x => x.BuyerId == request.BuyerId && x.LocationId == request.LocationId && x.IsActive && x.Status == Common.SILA_COUNT_IN_PROGRESS)
                .AnyAsync(cancellationToken);
            if (busy)
            {
                logger.LogInfo($"Physical inventory waits for the open count of the location. RequestId: {request.Id}, LocationId: {request.LocationId}");
                return false;
            }

            // The system opens the count with full access; the requester is recorded as the actor.
            StockCount count = await SilaStockCountRules.CreateCountAsync(
                repository,
                logger,
                ledger,
                request.BuyerId,
                request.RequestedBy,
                Common.COST_CONTROLLER_ROLE_ID,
                request.LocationId,
                Common.SILA_COUNT_SURPRISE,
                true,
                $"Physical inventory {request.RequestNumber}: {request.Reason}",
                cancellationToken);
            request.StockCountId = count.Id;
            request.Status = Common.SILA_PI_IN_PROGRESS;
            ledger.AddEvent(Common.SILA_REF_PHYSICAL_INVENTORY, request.Id, EVENT_STARTED, count.CountNumber);
            return true;
        }

        /// <summary>Completes (count approved) or cancels (count cancelled) the request linked to the count.</summary>
        public static async Task CloseForCountAsync(
            IRepositoryWrapper repository, InventoryLedger ledger, StockCount count, string status, CancellationToken cancellationToken)
        {
            PhysicalInventoryRequest? request = await repository.PhysicalInventoryRequest.FindFirstByConditionAsync(
                x => x.BuyerId == count.BuyerId && x.StockCountId == count.Id && x.IsActive && x.Status == Common.SILA_PI_IN_PROGRESS);
            if (request == null)
            {
                return;
            }

            request.Status = status;
            ledger.AddEvent(Common.SILA_REF_PHYSICAL_INVENTORY, request.Id, status, $"{count.CountNumber} {count.Status}");
        }

        /// <summary>A request of the buyer, tracked, after checking the user may work with its location.</summary>
        public static async Task<PhysicalInventoryRequest> GetAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid userId, Guid roleId, Guid requestId, CancellationToken cancellationToken)
        {
            PhysicalInventoryRequest? request = await repository.PhysicalInventoryRequest.FindFirstByConditionAsync(
                x => x.Id == requestId && x.BuyerId == buyerId && x.IsActive);
            if (request == null)
            {
                logger.LogError($"Physical inventory request not found. RequestId: {requestId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Physical inventory not found.", "Open a physical inventory request of this organization.");
            }

            await SilaAccess.EnsureLocationAccessAsync(repository, logger, buyerId, userId, roleId, request.LocationId, cancellationToken);
            return request;
        }

        public static void EnsureScheduled(ILoggerManager logger, PhysicalInventoryRequest request)
        {
            if (request.Status != Common.SILA_PI_SCHEDULED)
            {
                logger.LogError($"Physical inventory is not scheduled. RequestId: {request.Id}, Status: {request.Status}");
                throw new BadRequestCustomException(
                    "Physical inventory has started or is closed.",
                    $"{request.RequestNumber} is {request.Status}. Only a scheduled request can be changed; manage its count from the Stock Count screen.");
            }
        }

        public static async Task<List<SilaPhysicalInventoryDto>> MapAsync(
            IRepositoryWrapper repository, Guid buyerId, List<PhysicalInventoryRequest> requests, CancellationToken cancellationToken)
        {
            List<Guid> locationIds = requests.Select(x => x.LocationId).Distinct().ToList();
            List<Guid> countIds = requests.Where(x => x.StockCountId != null).Select(x => x.StockCountId!.Value).Distinct().ToList();
            List<Guid> alertIds = requests.Where(x => x.AlertId != null).Select(x => x.AlertId!.Value).Distinct().ToList();
            Dictionary<Guid, string> locations = await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && locationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.LocationName, cancellationToken);
            Dictionary<Guid, StockCount> counts = await repository.StockCount
                .FindByCondition(x => x.BuyerId == buyerId && countIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, string> alerts = await repository.InventoryAlert
                .FindByCondition(x => x.BuyerId == buyerId && alertIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.Title, cancellationToken);

            return requests.Select(x =>
            {
                StockCount? count = x.StockCountId != null && counts.TryGetValue(x.StockCountId.Value, out StockCount? found) ? found : null;
                return new SilaPhysicalInventoryDto
                {
                    Id = x.Id,
                    RequestNumber = x.RequestNumber,
                    LocationId = x.LocationId,
                    LocationName = locations.TryGetValue(x.LocationId, out string? name) ? name : null,
                    AlertId = x.AlertId,
                    AlertTitle = x.AlertId != null && alerts.TryGetValue(x.AlertId.Value, out string? title) ? title : null,
                    Reason = x.Reason,
                    ScheduledDate = x.ScheduledDate,
                    Status = x.Status,
                    StockCountId = x.StockCountId,
                    CountNumber = count?.CountNumber,
                    CountStatus = count?.Status,
                    RequestedBy = x.RequestedBy,
                    AssignedUserId = x.AssignedUserId,
                    DateCreated = x.DateCreated
                };
            }).ToList();
        }
    }
}
