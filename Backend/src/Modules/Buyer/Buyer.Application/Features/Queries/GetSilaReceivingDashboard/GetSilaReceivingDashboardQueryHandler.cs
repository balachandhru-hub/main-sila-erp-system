using System.Text.RegularExpressions;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaReceivingDashboard
{
    public class GetSilaReceivingDashboardQueryHandler : IRequestHandler<GetSilaReceivingDashboardQuery, SilaReceivingDashboardDto>
    {
        private const int WORKBENCH = 80;
        private const int TASKS = 20;
        private const int ACTIVITY = 10;
        private static readonly Regex HiddenErp = new Regex(
            "key ring|dataprotection|data protection|unprotect|decrypt|protected_password|/tmp/|/workspace/",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaReceivingDashboardQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaReceivingDashboardDto> Handle(GetSilaReceivingDashboardQuery request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            if (request.LocationId != null && request.LocationId != Guid.Empty)
            {
                await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, request.LocationId.Value, cancellationToken);
                locationIds = locationIds.Where(x => x == request.LocationId.Value).ToList();
            }

            List<InventoryLocation> locations = locationIds.Count == 0
                ? new List<InventoryLocation>()
                : await _repository.InventoryLocation.FindByCondition(x => locationIds.Contains(x.Id) && x.IsActive).ToListAsync(cancellationToken);
            if (request.PropertyId != null && request.PropertyId != Guid.Empty)
            {
                locations = locations.Where(x => x.PropertyId == request.PropertyId.Value).ToList();
                locationIds = locations.Select(x => x.Id).ToList();
            }

            List<Guid> propertyIds = locations.Select(x => x.PropertyId).Distinct().ToList();
            Dictionary<Guid, BuyerProperty> properties = propertyIds.Count == 0
                ? new Dictionary<Guid, BuyerProperty>()
                : await _repository.BuyerProperty.FindByCondition(x => propertyIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);

            DateTime today = DateTime.UtcNow.Date;
            string? supplier = string.IsNullOrWhiteSpace(request.Supplier) ? null : request.Supplier.Trim();

            List<PurchaseOrder> orders = await LoadOpenOrdersAsync(buyer.Id, supplier, cancellationToken);
            Dictionary<Guid, List<PurchaseOrderItem>> itemsByPo = await LoadItemsAsync(orders.Select(x => x.Id).ToList(), cancellationToken);
            orders = orders.Where(order =>
            {
                List<PurchaseOrderItem> items = itemsByPo.TryGetValue(order.Id, out List<PurchaseOrderItem>? found) ? found : new List<PurchaseOrderItem>();
                return items.Any(item => SilaReceivingRules.OpenQuantity(item) > 0);
            }).ToList();
            orders = FilterOrdersByLocation(orders, itemsByPo, locations, properties);

            List<GoodsReceipt> receipts = locationIds.Count == 0
                ? new List<GoodsReceipt>()
                : await _repository.GoodsReceipt
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && locationIds.Contains(x.LocationId))
                    .OrderByDescending(x => x.DateCreated)
                    .Take(400)
                    .ToListAsync(cancellationToken);
            List<Guid> postingIds = receipts.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            Dictionary<Guid, InventoryErpPosting> postings = postingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await _repository.InventoryErpPosting.FindByCondition(x => postingIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);

            Dictionary<Guid, GoodsReceipt> latestByPo = receipts
                .GroupBy(x => x.PurchaseOrderId)
                .ToDictionary(x => x.Key, x => x.OrderByDescending(g => g.DateCreated).First());

            List<OpenPo> open = orders.Select(order =>
            {
                List<PurchaseOrderItem> items = itemsByPo.TryGetValue(order.Id, out List<PurchaseOrderItem>? found) ? found : new List<PurchaseOrderItem>();
                decimal ordered = items.Sum(x => x.Quantity);
                decimal received = items.Sum(x => x.ReceivedQuantity);
                decimal openQty = items.Sum(SilaReceivingRules.OpenQuantity);
                int openLines = items.Count(x => SilaReceivingRules.OpenQuantity(x) > 0);
                bool partial = received > 0 && openQty > 0;
                bool expectedToday = order.DeliveryDate != null && order.DeliveryDate.Value.Date == today;
                bool overdue = order.DeliveryDate != null && order.DeliveryDate.Value.Date < today && openQty > 0;
                return new OpenPo(order, items, ordered, received, openQty, openLines, partial, expectedToday, overdue);
            }).ToList();

            List<GoodsReceipt> todayReceipts = receipts.Where(x => x.DateCreated.Date == today).ToList();
            List<(GoodsReceipt Receipt, InventoryErpPosting? Posting)> failed = receipts
                .Select(x => (Receipt: x, Posting: x.ErpPostingId != null && postings.TryGetValue(x.ErpPostingId.Value, out InventoryErpPosting? posting) ? posting : null))
                .Where(x => IsFailed(x.Posting) || IsUnknown(x.Posting))
                .ToList();

            SilaReceivingDashboardDto dashboard = new SilaReceivingDashboardDto
            {
                Locations = locations.Select(location => new SilaReceivingDashboardLocationDto
                {
                    Id = location.Id,
                    LocationName = location.LocationName,
                    PropertyName = properties.TryGetValue(location.PropertyId, out BuyerProperty? property) ? property.PropertyName : null,
                    PlantCode = properties.TryGetValue(location.PropertyId, out BuyerProperty? plant) ? plant.PlantCode : null,
                    StorageLocationCode = location.StorageLocationCode
                }).OrderBy(x => x.LocationName).ToList(),
                Kpis = new SilaReceivingDashboardKpisDto
                {
                    ExpectedToday = open.Count(x => x.ExpectedToday),
                    PendingReceipt = open.Count,
                    PartiallyReceived = open.Count(x => x.Partial),
                    ReceivedToday = todayReceipts.Count(x => x.ParentGoodsReceiptId == null && x.Status != Common.SILA_GRN_REVERSED),
                    Overdue = open.Count(x => x.Overdue),
                    GrnPostingFailed = failed.Count(x => IsFailed(x.Posting)),
                    ReversalsToday = todayReceipts.Count(x => x.ParentGoodsReceiptId != null || x.Status == Common.SILA_GRN_REVERSED),
                    AttentionRequired = open.Count(x => x.Overdue) + failed.Count
                },
                Aging = AgeOf(open, today, failed.Count(x => IsFailed(x.Posting) || IsUnknown(x.Posting))),
                Team = new SilaReceivingTeamDto
                {
                    ReceiptsCompleted = todayReceipts.Count(x => x.ParentGoodsReceiptId == null),
                    GrnsPosted = todayReceipts.Count(x => x.Status == Common.SILA_GRN_POSTED),
                    PartialReceipts = open.Count(x => x.Partial),
                    Reversals = todayReceipts.Count(x => x.ParentGoodsReceiptId != null || x.Status == Common.SILA_GRN_REVERSED),
                    Failures = failed.Count(x => x.Receipt.DateCreated.Date == today)
                }
            };

            Dictionary<Guid, string?> supplierByPo = orders.ToDictionary(x => x.Id, x => x.SupplierName);
            List<Guid> missingPoIds = failed
                .Select(x => x.Receipt.PurchaseOrderId)
                .Where(id => !supplierByPo.ContainsKey(id))
                .Distinct()
                .ToList();
            if (missingPoIds.Count > 0)
            {
                List<PurchaseOrder> extra = await _repository.PurchaseOrder
                    .FindByCondition(x => missingPoIds.Contains(x.Id))
                    .ToListAsync(cancellationToken);
                foreach (PurchaseOrder extraOrder in extra)
                {
                    supplierByPo[extraOrder.Id] = extraOrder.SupplierName;
                }
            }

            dashboard.Tasks = BuildTasks(open, failed, locations, supplierByPo, DateTime.UtcNow).Take(TASKS).ToList();
            dashboard.Workbench = BuildWorkbench(open, latestByPo, postings, locations, properties).Take(WORKBENCH).ToList();
            dashboard.Exceptions = BuildExceptions(open, failed, locations, supplierByPo, DateTime.UtcNow);
            dashboard.Activity = receipts.Take(ACTIVITY).Select(receipt =>
            {
                bool reversed = receipt.ParentGoodsReceiptId != null || receipt.Status == Common.SILA_GRN_REVERSED;
                string action = reversed
                    ? $"Reversed · {receipt.PoNumber}"
                    : receipt.Status == Common.SILA_GRN_POSTED
                        ? $"Posted · {receipt.PoNumber}"
                        : $"{receipt.Status} · {receipt.PoNumber}";
                return new SilaReceivingActivityDto
                {
                    OccurredOn = receipt.DateCreated,
                    Document = receipt.GrnNumber,
                    Action = action,
                    Status = receipt.ErpPostingId != null && postings.TryGetValue(receipt.ErpPostingId.Value, out InventoryErpPosting? posting)
                        ? posting.Status
                        : receipt.Status,
                    PurchaseOrderId = receipt.PurchaseOrderId,
                    GoodsReceiptId = receipt.Id
                };
            }).ToList();

            _logger.LogInfo($"Receiving dashboard fetched. OpenPos: {open.Count}, Grns: {receipts.Count}, BuyerId: {buyer.Id}");
            return dashboard;
        }

        private async Task<List<PurchaseOrder>> LoadOpenOrdersAsync(Guid buyerId, string? supplier, CancellationToken cancellationToken)
        {
            IQueryable<PurchaseOrder> query = _repository.PurchaseOrder.FindByCondition(x =>
                x.BuyerId == buyerId
                && x.IsActive
                && x.Status != SilaReceivingRules.PO_CANCELLED
                && x.Status != Common.SILA_PO_RECEIVED);
            if (supplier != null)
            {
                query = query.Where(x => (x.SupplierName != null && x.SupplierName.Contains(supplier)) || x.PoNumber.Contains(supplier));
            }

            return await query.OrderBy(x => x.DeliveryDate ?? x.OrderDate).Take(400).ToListAsync(cancellationToken);
        }

        private async Task<Dictionary<Guid, List<PurchaseOrderItem>>> LoadItemsAsync(List<Guid> poIds, CancellationToken cancellationToken)
        {
            if (poIds.Count == 0)
            {
                return new Dictionary<Guid, List<PurchaseOrderItem>>();
            }

            List<PurchaseOrderItem> items = await _repository.PurchaseOrderItem
                .FindByCondition(x => poIds.Contains(x.PurchaseOrderId) && x.IsActive)
                .ToListAsync(cancellationToken);
            return items.GroupBy(x => x.PurchaseOrderId).ToDictionary(x => x.Key, x => x.ToList());
        }

        private static List<PurchaseOrder> FilterOrdersByLocation(
            List<PurchaseOrder> orders,
            Dictionary<Guid, List<PurchaseOrderItem>> itemsByPo,
            List<InventoryLocation> locations,
            Dictionary<Guid, BuyerProperty> properties)
        {
            if (locations.Count == 0)
            {
                return new List<PurchaseOrder>();
            }

            HashSet<string> plants = properties.Values
                .Select(x => x.PlantCode)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x!.Trim())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            HashSet<string> storage = locations
                .Select(x => x.StorageLocationCode)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x!.Trim())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            HashSet<Guid> outlets = locations.Where(x => x.OutletId != null).Select(x => x.OutletId!.Value).ToHashSet();
            if (plants.Count == 0 && storage.Count == 0 && outlets.Count == 0)
            {
                return orders;
            }

            return orders.Where(order =>
            {
                List<PurchaseOrderItem> items = itemsByPo.TryGetValue(order.Id, out List<PurchaseOrderItem>? found)
                    ? found
                    : new List<PurchaseOrderItem>();
                bool plantMatch = !string.IsNullOrWhiteSpace(order.PlantCode) && plants.Contains(order.PlantCode.Trim());
                bool lineMatch = items.Any(item =>
                    (!string.IsNullOrWhiteSpace(item.StorageLocation) && storage.Contains(item.StorageLocation.Trim()))
                    || (item.OutletId != null && outlets.Contains(item.OutletId.Value)));
                return plantMatch || lineMatch;
            }).ToList();
        }

        private static SilaReceivingAgingDto AgeOf(List<OpenPo> open, DateTime today, int unresolvedFailures)
        {
            int AgeDays(OpenPo row) => (int)(today - (row.Order.DeliveryDate ?? row.Order.OrderDate).Date).TotalDays;
            return new SilaReceivingAgingDto
            {
                PendingUnderOneDay = open.Count(x => AgeDays(x) < 1),
                PendingOneToTwoDays = open.Count(x => AgeDays(x) is >= 1 and <= 2),
                PendingThreePlusDays = open.Count(x => AgeDays(x) >= 3),
                Overdue = open.Count(x => x.Overdue),
                OpenPartials = open.Count(x => x.Partial),
                UnresolvedGrnFailures = unresolvedFailures
            };
        }

        private static List<SilaReceivingTaskDto> BuildTasks(
            List<OpenPo> open,
            List<(GoodsReceipt Receipt, InventoryErpPosting? Posting)> failed,
            List<InventoryLocation> locations,
            Dictionary<Guid, string?> supplierByPo,
            DateTime now)
        {
            Dictionary<Guid, string> locationNames = locations.ToDictionary(x => x.Id, x => x.LocationName);
            List<SilaReceivingTaskDto> tasks = new List<SilaReceivingTaskDto>();
            foreach ((GoodsReceipt receipt, InventoryErpPosting? posting) in failed)
            {
                bool unknown = IsUnknown(posting);
                tasks.Add(new SilaReceivingTaskDto
                {
                    Priority = "CRITICAL",
                    Type = unknown ? "GRN_UNKNOWN" : "GRN_FAILED",
                    Title = unknown ? "Review GRN posting status" : "Review failed GRN posting",
                    PoNumber = receipt.PoNumber,
                    GrnNumber = receipt.GrnNumber,
                    SupplierName = supplierByPo.TryGetValue(receipt.PurchaseOrderId, out string? supplier) ? supplier : null,
                    LocationName = locationNames.TryGetValue(receipt.LocationId, out string? name) ? name : null,
                    Age = AgeText(receipt.DateCreated, now),
                    Status = posting?.Status ?? receipt.Status,
                    Action = "REVIEW",
                    PurchaseOrderId = receipt.PurchaseOrderId,
                    GoodsReceiptId = receipt.Id
                });
            }

            foreach (OpenPo row in open.Where(x => x.Overdue).OrderBy(x => x.Order.DeliveryDate))
            {
                tasks.Add(PoTask(row, "ACTION_REQUIRED", "OVERDUE", "Receive overdue PO", "RECEIVE", now));
            }

            foreach (OpenPo row in open.Where(x => x.ExpectedToday && !x.Overdue))
            {
                tasks.Add(PoTask(row, "ACTION_REQUIRED", "EXPECTED_TODAY", "Receive PO expected today", "RECEIVE", now));
            }

            foreach (OpenPo row in open.Where(x => x.Partial && !x.Overdue && !x.ExpectedToday))
            {
                tasks.Add(PoTask(row, "ACTION_REQUIRED", "PARTIAL", "Continue partial receipt", "RECEIVE_BALANCE", now));
            }

            return tasks
                .OrderBy(x => x.Priority == "CRITICAL" ? 0 : 1)
                .ThenBy(x => x.ExpectedDate)
                .ToList();
        }

        private static SilaReceivingTaskDto PoTask(OpenPo row, string priority, string type, string title, string action, DateTime now)
        {
            return new SilaReceivingTaskDto
            {
                Priority = priority,
                Type = type,
                Title = title,
                PoNumber = row.Order.PoNumber,
                SupplierName = row.Order.SupplierName,
                ExpectedDate = row.Order.DeliveryDate,
                Age = AgeText(row.Order.DeliveryDate ?? row.Order.OrderDate, now),
                Status = row.Partial ? Common.SILA_PO_PARTIALLY_RECEIVED : row.Order.Status,
                Action = action,
                PurchaseOrderId = row.Order.Id,
                OpenLineCount = row.OpenLines
            };
        }

        private static List<SilaReceivingWorkbenchRowDto> BuildWorkbench(
            List<OpenPo> open,
            Dictionary<Guid, GoodsReceipt> latestByPo,
            Dictionary<Guid, InventoryErpPosting> postings,
            List<InventoryLocation> locations,
            Dictionary<Guid, BuyerProperty> properties)
        {
            return open.Select(row =>
            {
                latestByPo.TryGetValue(row.Order.Id, out GoodsReceipt? latest);
                InventoryErpPosting? posting = latest?.ErpPostingId != null && postings.TryGetValue(latest.ErpPostingId.Value, out InventoryErpPosting? found) ? found : null;
                InventoryLocation? location = latest == null ? null : locations.FirstOrDefault(x => x.Id == latest.LocationId);
                string? storage = row.Items.Select(x => x.StorageLocation).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))
                    ?? location?.StorageLocationCode;
                string receiptStatus = row.Overdue ? "OVERDUE" : row.ExpectedToday ? "EXPECTED_TODAY" : row.Partial ? "PARTIAL" : "PENDING";
                return new SilaReceivingWorkbenchRowDto
                {
                    PurchaseOrderId = row.Order.Id,
                    PoNumber = row.Order.PoNumber,
                    SupplierName = row.Order.SupplierName,
                    ExpectedDate = row.Order.DeliveryDate,
                    PropertyName = location != null && properties.TryGetValue(location.PropertyId, out BuyerProperty? property) ? property.PropertyName : null,
                    PlantCode = row.Order.PlantCode,
                    StorageLocation = storage,
                    LineCount = row.Items.Count,
                    OpenLineCount = row.OpenLines,
                    OrderedQty = row.Ordered,
                    ReceivedQty = row.Received,
                    OpenQty = row.OpenQty,
                    ReceiptStatus = receiptStatus,
                    LatestGrnNumber = latest?.GrnNumber,
                    LatestGoodsReceiptId = latest?.Id,
                    ErpStatus = posting?.Status ?? latest?.Status,
                    SupplierSoNumber = row.Order.SupplierErpSalesOrderNumber,
                    LastActivity = latest?.DateCreated ?? row.Order.DateUpdated,
                    Action = row.Partial ? "RECEIVE_BALANCE" : "RECEIVE"
                };
            }).ToList();
        }

        private static List<SilaReceivingExceptionDto> BuildExceptions(
            List<OpenPo> open,
            List<(GoodsReceipt Receipt, InventoryErpPosting? Posting)> failed,
            List<InventoryLocation> locations,
            Dictionary<Guid, string?> supplierByPo,
            DateTime now)
        {
            Dictionary<Guid, string> locationNames = locations.ToDictionary(x => x.Id, x => x.LocationName);
            List<SilaReceivingExceptionDto> rows = new List<SilaReceivingExceptionDto>();
            foreach ((GoodsReceipt receipt, InventoryErpPosting? posting) in failed)
            {
                bool unknown = IsUnknown(posting);
                rows.Add(new SilaReceivingExceptionDto
                {
                    Severity = "CRITICAL",
                    Exception = unknown ? "GRN posting unknown" : "GRN posting failed",
                    Document = receipt.GrnNumber,
                    SupplierName = supplierByPo.TryGetValue(receipt.PurchaseOrderId, out string? supplier) ? supplier : null,
                    LocationName = locationNames.TryGetValue(receipt.LocationId, out string? name) ? name : null,
                    Age = AgeText(receipt.DateCreated, now),
                    Status = posting?.Status ?? receipt.Status,
                    Action = "REVIEW",
                    PurchaseOrderId = receipt.PurchaseOrderId,
                    GoodsReceiptId = receipt.Id,
                    Message = SafeMessage(posting?.ErrorMessage)
                });
            }

            foreach (OpenPo row in open.Where(x => x.Overdue))
            {
                rows.Add(new SilaReceivingExceptionDto
                {
                    Severity = "ACTION_REQUIRED",
                    Exception = "Overdue receipt",
                    Document = row.Order.PoNumber,
                    SupplierName = row.Order.SupplierName,
                    Age = AgeText(row.Order.DeliveryDate ?? row.Order.OrderDate, now),
                    Status = row.Order.Status,
                    Action = "RECEIVE",
                    PurchaseOrderId = row.Order.Id
                });
            }

            foreach (OpenPo row in open.Where(x => x.Partial && AgeDays(x.Order.DeliveryDate ?? x.Order.OrderDate, now.Date) >= 3))
            {
                rows.Add(new SilaReceivingExceptionDto
                {
                    Severity = "ACTION_REQUIRED",
                    Exception = "Partial receipt aging",
                    Document = row.Order.PoNumber,
                    SupplierName = row.Order.SupplierName,
                    Age = AgeText(row.Order.DeliveryDate ?? row.Order.OrderDate, now),
                    Status = Common.SILA_PO_PARTIALLY_RECEIVED,
                    Action = "RECEIVE_BALANCE",
                    PurchaseOrderId = row.Order.Id
                });
            }

            return rows;
        }

        private static bool IsFailed(InventoryErpPosting? posting)
        {
            return posting != null && (posting.Status == Common.SILA_POSTING_FAILED || posting.Status == Common.SILA_POSTING_SKIPPED);
        }

        private static bool IsUnknown(InventoryErpPosting? posting)
        {
            return posting != null && posting.Status == Common.SILA_POSTING_UNKNOWN;
        }

        private static string? SafeMessage(string? message)
        {
            if (string.IsNullOrWhiteSpace(message))
            {
                return null;
            }

            return HiddenErp.IsMatch(message) ? "ERP posting needs attention. Open the goods receipt to review." : message.Trim();
        }

        private static string AgeText(DateTime when, DateTime now)
        {
            TimeSpan span = now - when;
            if (span.TotalMinutes < 60)
            {
                return Math.Max(0, (int)span.TotalMinutes) + " min";
            }

            if (span.TotalHours < 24)
            {
                return (int)span.TotalHours + " h";
            }

            return (int)span.TotalDays + " d";
        }

        private static int AgeDays(DateTime when, DateTime today)
        {
            return (int)(today - when.Date).TotalDays;
        }

        private sealed record OpenPo(
            PurchaseOrder Order,
            List<PurchaseOrderItem> Items,
            decimal Ordered,
            decimal Received,
            decimal OpenQty,
            int OpenLines,
            bool Partial,
            bool ExpectedToday,
            bool Overdue);
    }
}
