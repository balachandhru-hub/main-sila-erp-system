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
                .Where(x => IsFailed(x.Posting) || IsUnknown(x.Posting) || IsLocal(x.Posting))
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
                    AttentionRequired = open.Count(x => x.Overdue) + failed.Count(x => !IsLocal(x.Posting))
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
            foreach (GoodsReceipt receipt in receipts.Where(x =>
                string.Equals(x.ReversalStatus, Common.SILA_POSTING_FAILED, StringComparison.OrdinalIgnoreCase)))
            {
                dashboard.Exceptions.Add(new SilaReceivingExceptionDto
                {
                    Severity = "CRITICAL",
                    Exception = "GRN reversal failed",
                    Document = receipt.GrnNumber,
                    SupplierName = supplierByPo.TryGetValue(receipt.PurchaseOrderId, out string? reversalSupplier) ? reversalSupplier : null,
                    Age = AgeText(receipt.DateCreated, DateTime.UtcNow),
                    Status = receipt.ReversalStatus,
                    Action = "REVIEW",
                    PurchaseOrderId = receipt.PurchaseOrderId,
                    GoodsReceiptId = receipt.Id
                });
            }
            await AppendHomeModulesAsync(dashboard, buyer.Id, receipts, postings, locationIds, supplierByPo, cancellationToken);
            await RestrictApprovalsAsync(dashboard, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            ApplyPermissionFilter(dashboard, request.PermissionCodes);
            await SilaOperationsSync.ApplyDashboardAsync(_repository, buyer.Id, request.UserId, dashboard, cancellationToken);
            dashboard.Kpis.AttentionRequired = dashboard.Exceptions.Count;
            IEnumerable<SilaReceivingActivityDto> receivingActivity = HasPermission(request.PermissionCodes, "VIEW_SILA_RECEIVING")
                ? receipts.Take(ACTIVITY).Select(receipt =>
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
                })
                : Enumerable.Empty<SilaReceivingActivityDto>();
            dashboard.Activity = receivingActivity
                .Concat(dashboard.Activity)
                .Where(row => ActivityAllowed(row, request.PermissionCodes))
                .OrderByDescending(x => x.OccurredOn)
                .Take(ACTIVITY)
                .ToList();

            _logger.LogInfo($"Receiving dashboard fetched. OpenPos: {open.Count}, Grns: {receipts.Count}, BuyerId: {buyer.Id}");
            return dashboard;
        }

        private async Task AppendHomeModulesAsync(
            SilaReceivingDashboardDto dashboard,
            Guid buyerId,
            List<GoodsReceipt> receipts,
            Dictionary<Guid, InventoryErpPosting> postings,
            List<Guid> locationIds,
            Dictionary<Guid, string?> supplierByPo,
            CancellationToken cancellationToken)
        {
            DateTime now = DateTime.UtcNow;
            DateTime today = now.Date;
            List<Guid> invoiceIds = receipts.Where(x => x.InvoiceId != null).Select(x => x.InvoiceId!.Value).Distinct().ToList();
            Dictionary<Guid, Invoice> heldInvoices = invoiceIds.Count == 0
                ? new Dictionary<Guid, Invoice>()
                : await _repository.Invoice.FindByCondition(x => invoiceIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            List<Guid> heldPostingIds = heldInvoices.Values.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).Distinct().ToList();
            Dictionary<Guid, InventoryErpPosting> invoicePostings = heldPostingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await _repository.InventoryErpPosting.FindByCondition(x => heldPostingIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);

            List<SilaReceivingTaskDto> invoiceTasks = new List<SilaReceivingTaskDto>();
            foreach (GoodsReceipt receipt in receipts)
            {
                if (!SilaInvoiceCreation.IsPostedForInvoice(receipt, postings))
                {
                    continue;
                }

                if (receipt.InvoiceId != null && heldInvoices.TryGetValue(receipt.InvoiceId.Value, out Invoice? locked))
                {
                    string? lockedErp = locked.ErpPostingId != null
                        && invoicePostings.TryGetValue(locked.ErpPostingId.Value, out InventoryErpPosting? lockedPosting)
                        ? lockedPosting.Status
                        : null;
                    if (SilaGoodsReceiptSelection.Holds(locked.Status, lockedErp) || !string.IsNullOrWhiteSpace(locked.Status))
                    {
                        continue;
                    }
                }

                invoiceTasks.Add(new SilaReceivingTaskDto
                {
                    Priority = "ACTION_REQUIRED",
                    Type = "PROCESS_INVOICE",
                    Title = "Process invoice",
                    PoNumber = receipt.PoNumber,
                    GrnNumber = receipt.GrnNumber,
                    SupplierName = supplierByPo.TryGetValue(receipt.PurchaseOrderId, out string? supplier) ? supplier : null,
                    Age = AgeText(receipt.DateCreated, now),
                    Status = Common.SILA_INVOICE_READY,
                    Action = "PROCESS_INVOICE",
                    PurchaseOrderId = receipt.PurchaseOrderId,
                    GoodsReceiptId = receipt.Id
                });
            }

            dashboard.Tasks = invoiceTasks.Concat(dashboard.Tasks).ToList();
            dashboard.Invoice.ReadyForProcessing = invoiceTasks.Count;
            foreach (SilaReceivingTaskDto ready in invoiceTasks.Take(8))
            {
                dashboard.Exceptions.Add(new SilaReceivingExceptionDto
                {
                    Severity = "ACTION_REQUIRED",
                    Exception = "Invoice ready for processing",
                    Document = ready.GrnNumber ?? ready.PoNumber ?? "GRN",
                    SupplierName = ready.SupplierName,
                    Age = ready.Age,
                    Status = ready.Status,
                    Action = "PROCESS_INVOICE",
                    PurchaseOrderId = ready.PurchaseOrderId,
                    GoodsReceiptId = ready.GoodsReceiptId
                });
            }

            List<Invoice> invoices = await _repository.Invoice
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .OrderByDescending(x => x.DateCreated)
                .Take(400)
                .ToListAsync(cancellationToken);
            HashSet<string> posted = SilaInvoiceLifecycle.PostedStatuses.ToHashSet(StringComparer.OrdinalIgnoreCase);
            string[] failedInvoice =
            {
                Common.SILA_INVOICE_POSTING_FAILED, Common.SILA_INVOICE_POSTING_UNKNOWN, Common.SILA_INVOICE_LOCAL_FAILED,
                Common.SILA_INVOICE_OCR_FAILED, Common.SILA_INVOICE_VALIDATION_FAILED
            };
            string[] inProgressInvoice =
            {
                Common.SILA_INVOICE_UPLOADED, Common.SILA_INVOICE_EXTRACTED,
                Common.SILA_INVOICE_REVIEWED, Common.SILA_INVOICE_GRN_IN_PROGRESS, Common.SILA_INVOICE_READY,
                Common.SILA_INVOICE_PENDING_APPROVAL, Common.SILA_INVOICE_READY_TO_POST, Common.SILA_INVOICE_POSTING
            };
            dashboard.Invoice.InProgress = invoices.Count(x => inProgressInvoice.Contains(x.Status));
            dashboard.Invoice.PendingApproval = invoices.Count(x => x.Status == Common.SILA_INVOICE_PENDING_APPROVAL);
            dashboard.Invoice.PostingFailed = invoices.Count(x => failedInvoice.Contains(x.Status));
            dashboard.Invoice.PostedRecently = invoices.Count(x => posted.Contains(x.Status) && x.DateCreated.Date == today);

            foreach (Invoice invoice in invoices.Where(x => failedInvoice.Contains(x.Status) || x.Status == Common.SILA_INVOICE_PENDING_APPROVAL).Take(20))
            {
                string exception = invoice.Status switch
                {
                    Common.SILA_INVOICE_POSTING_UNKNOWN => "Invoice posting unknown",
                    Common.SILA_INVOICE_VALIDATION_FAILED => "Invoice validation failed",
                    Common.SILA_INVOICE_PENDING_APPROVAL => "Invoice approval required",
                    Common.SILA_INVOICE_LOCAL_FAILED => "Invoice local finalization failed",
                    _ => "Invoice posting failed"
                };
                dashboard.Exceptions.Add(new SilaReceivingExceptionDto
                {
                    Severity = invoice.Status == Common.SILA_INVOICE_POSTING_UNKNOWN ? "CRITICAL" : "ACTION_REQUIRED",
                    Exception = exception,
                    Document = invoice.InvoiceNumber ?? invoice.FileName,
                    SupplierName = invoice.SupplierName,
                    Age = AgeText(invoice.DateCreated, now),
                    Status = invoice.Status,
                    Action = "REVIEW",
                    PurchaseOrderId = invoice.PurchaseOrderId,
                    InvoiceId = invoice.Id
                });
                if (invoice.Status != Common.SILA_INVOICE_PENDING_APPROVAL)
                {
                    dashboard.Tasks.Add(new SilaReceivingTaskDto
                    {
                        Priority = invoice.Status == Common.SILA_INVOICE_POSTING_UNKNOWN ? "CRITICAL" : "ACTION_REQUIRED",
                        Type = "INVOICE",
                        Title = exception,
                        PoNumber = invoice.PoNumber,
                        SupplierName = invoice.SupplierName,
                        Age = AgeText(invoice.DateCreated, now),
                        Status = invoice.Status,
                        Action = "REVIEW",
                        PurchaseOrderId = invoice.PurchaseOrderId,
                        InvoiceId = invoice.Id
                    });
                }
            }

            foreach (Invoice invoice in invoices.Where(x => x.Status == Common.SILA_INVOICE_PENDING_APPROVAL).Take(10))
            {
                    dashboard.Approvals.Add(new SilaHomeApprovalDto
                    {
                        Type = "Invoice Approval",
                        Document = invoice.InvoiceNumber ?? invoice.FileName,
                        SupplierName = invoice.SupplierName,
                        Amount = invoice.GrossAmount,
                        Age = AgeText(invoice.DateCreated, now),
                        Status = invoice.Status,
                        Action = "REVIEW",
                        InvoiceId = invoice.Id
                    });
                    dashboard.Tasks.Add(new SilaReceivingTaskDto
                    {
                        Priority = "ACTION_REQUIRED",
                        Type = "INVOICE",
                        Title = "Approve invoice",
                        PoNumber = invoice.PoNumber,
                        SupplierName = invoice.SupplierName,
                        Age = AgeText(invoice.DateCreated, now),
                        Status = invoice.Status,
                        Action = "REVIEW",
                        PurchaseOrderId = invoice.PurchaseOrderId,
                        InvoiceId = invoice.Id
                    });
                }

            List<CreditMemo> memos = await _repository.CreditMemo
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .OrderByDescending(x => x.DateCreated)
                .Take(200)
                .ToListAsync(cancellationToken);
            dashboard.CreditMemo.InProgress = memos.Count(x => SilaCreditMemoLifecycle.OpenStatuses.Contains(x.Status) || x.Status == Common.SILA_CREDIT_MEMO_POSTING);
            dashboard.CreditMemo.PendingApproval = memos.Count(x => x.Status == Common.SILA_CREDIT_MEMO_PENDING_APPROVAL);
            dashboard.CreditMemo.PostingFailed = memos.Count(x =>
                x.Status == Common.SILA_CREDIT_MEMO_POSTING_FAILED || x.Status == Common.SILA_CREDIT_MEMO_POSTING_UNKNOWN);
            dashboard.CreditMemo.PostedRecently = memos.Count(x => x.Status == Common.SILA_CREDIT_MEMO_POSTED && x.DateCreated.Date == today);
            foreach (CreditMemo memo in memos.Where(x => x.Status == Common.SILA_CREDIT_MEMO_PENDING_APPROVAL).Take(10))
            {
                dashboard.Approvals.Add(new SilaHomeApprovalDto
                {
                    Type = "Credit Memo Approval",
                    Document = memo.CreditMemoNumber ?? memo.CreditMemoReference ?? "Credit memo",
                    SupplierName = memo.SupplierName,
                    Amount = memo.GrossAmount,
                    Age = AgeText(memo.DateCreated, now),
                    Status = memo.Status,
                    Action = "REVIEW",
                    PurchaseOrderId = memo.PurchaseOrderId,
                    InvoiceId = memo.ReferenceInvoiceId,
                    CreditMemoId = memo.Id
                });
            }

            foreach (CreditMemo memo in memos.Where(x =>
                x.Status == Common.SILA_CREDIT_MEMO_POSTING_FAILED
                || x.Status == Common.SILA_CREDIT_MEMO_POSTING_UNKNOWN
                || x.Status == Common.SILA_CREDIT_MEMO_LOCAL_FAILED).Take(8))
            {
                dashboard.Exceptions.Add(new SilaReceivingExceptionDto
                {
                    Severity = memo.Status == Common.SILA_CREDIT_MEMO_POSTING_UNKNOWN ? "CRITICAL" : "ACTION_REQUIRED",
                    Exception = memo.Status == Common.SILA_CREDIT_MEMO_POSTING_UNKNOWN ? "Credit memo posting unknown" : "Credit memo posting failed",
                    Document = memo.CreditMemoNumber ?? memo.CreditMemoReference ?? "Credit memo",
                    SupplierName = memo.SupplierName,
                    Age = AgeText(memo.DateCreated, now),
                    Status = memo.Status,
                    Action = "REVIEW",
                    PurchaseOrderId = memo.PurchaseOrderId,
                    InvoiceId = memo.ReferenceInvoiceId,
                    CreditMemoId = memo.Id
                });
                dashboard.Tasks.Add(new SilaReceivingTaskDto
                {
                    Priority = memo.Status == Common.SILA_CREDIT_MEMO_POSTING_UNKNOWN ? "CRITICAL" : "ACTION_REQUIRED",
                    Type = "CREDIT_MEMO",
                    Title = "Review credit memo",
                    PoNumber = memo.PoNumber,
                    SupplierName = memo.SupplierName,
                    Age = AgeText(memo.DateCreated, now),
                    Status = memo.Status,
                    Action = "REVIEW",
                    PurchaseOrderId = memo.PurchaseOrderId,
                    InvoiceId = memo.ReferenceInvoiceId,
                    CreditMemoId = memo.Id
                });
            }

            if (locationIds.Count > 0)
            {
                List<InternalTransferOrder> transfers = await _repository.InternalTransferOrder
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive
                        && locationIds.Contains(x.FromLocationId)
                        && x.Status == Common.SILA_ITO_PENDING_APPROVAL)
                    .OrderBy(x => x.DateCreated)
                    .Take(10)
                    .ToListAsync(cancellationToken);
                foreach (InternalTransferOrder transfer in transfers)
                {
                    dashboard.Approvals.Add(new SilaHomeApprovalDto
                    {
                        Type = "Transfer Approval",
                        Document = transfer.ItoNumber,
                        Age = AgeText(transfer.DateCreated, now),
                        Status = transfer.Status,
                        Action = "REVIEW",
                        TransferId = transfer.Id
                    });
                }
            }

            dashboard.Tasks = dashboard.Tasks
                .OrderBy(x => x.Priority == "CRITICAL" ? 0 : 1)
                .ThenBy(x => x.ExpectedDate)
                .Take(TASKS)
                .ToList();

            foreach (Invoice invoice in invoices.Where(x => posted.Contains(x.Status)).Take(8))
            {
                dashboard.Activity.Add(new SilaReceivingActivityDto
                {
                    OccurredOn = invoice.DateUpdated != default ? invoice.DateUpdated : invoice.DateCreated,
                    Document = invoice.InvoiceNumber ?? invoice.FileName,
                    Action = "Invoice posted",
                    Status = invoice.Status,
                    PurchaseOrderId = invoice.PurchaseOrderId,
                    InvoiceId = invoice.Id
                });
            }

            foreach (CreditMemo memo in memos.Where(x => x.Status == Common.SILA_CREDIT_MEMO_POSTED).Take(8))
            {
                dashboard.Activity.Add(new SilaReceivingActivityDto
                {
                    OccurredOn = memo.DateUpdated != default ? memo.DateUpdated : memo.DateCreated,
                    Document = memo.CreditMemoNumber ?? memo.CreditMemoReference ?? "Credit memo",
                    Action = "Credit memo posted",
                    Status = memo.Status,
                    PurchaseOrderId = memo.PurchaseOrderId,
                    InvoiceId = memo.ReferenceInvoiceId,
                    CreditMemoId = memo.Id
                });
            }
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
                bool local = IsLocal(posting);
                tasks.Add(new SilaReceivingTaskDto
                {
                    Priority = "CRITICAL",
                    Type = local ? "GRN_LOCAL" : unknown ? "GRN_UNKNOWN" : "GRN_FAILED",
                    Title = local
                        ? "Complete GRN local finalization"
                        : unknown ? "Review GRN posting status" : "Review failed GRN posting",
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
                bool local = IsLocal(posting);
                bool reversalFailed = string.Equals(receipt.ReversalStatus, Common.SILA_POSTING_FAILED, StringComparison.OrdinalIgnoreCase);
                rows.Add(new SilaReceivingExceptionDto
                {
                    Severity = "CRITICAL",
                    Exception = reversalFailed
                        ? "GRN reversal failed"
                        : local
                            ? "GRN local finalization failed"
                            : unknown ? "GRN posting unknown" : "GRN posting failed",
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

        private async Task RestrictApprovalsAsync(
            SilaReceivingDashboardDto dashboard, Guid buyerId, Guid userId, Guid roleId, CancellationToken cancellationToken)
        {
            bool administrator = SilaAccess.HasFullAccess(roleId);
            List<Guid> invoices = await SilaApprovals.PendingForUserAsync(
                _repository, buyerId, Common.SILA_REF_INVOICE, userId, cancellationToken, administrator);
            List<Guid> memos = await SilaApprovals.PendingForUserAsync(
                _repository, buyerId, Common.SILA_REF_CREDIT_MEMO, userId, cancellationToken, administrator);
            dashboard.Approvals = dashboard.Approvals.Where(row =>
                (row.InvoiceId != null && invoices.Contains(row.InvoiceId.Value))
                || (row.CreditMemoId != null && memos.Contains(row.CreditMemoId.Value))
                || row.TransferId != null).ToList();
        }

        /// <summary>
        /// Drops document numbers, tasks, exceptions and approvals the caller cannot view.
        /// Uses Identity permission codes, not frontend capability flags. Location scope is unchanged.
        /// Task assignment and approval-step eligibility never grant a module view.
        /// </summary>
        private static void ApplyPermissionFilter(SilaReceivingDashboardDto dashboard, List<string> codes)
        {
            bool viewReceiving = HasPermission(codes, "VIEW_SILA_RECEIVING");
            bool viewInvoice = HasPermission(codes, "VIEW_SILA_INVOICE");
            bool viewCreditMemo = HasPermission(codes, "VIEW_SILA_CREDIT_MEMO");
            bool approveInvoice = viewInvoice && HasPermission(codes, "APPROVE_SILA_INVOICE");
            bool approveCreditMemo = viewCreditMemo && HasPermission(codes, "APPROVE_SILA_CREDIT_MEMO");
            bool viewTransfer = HasPermission(codes, "VIEW_SILA_INVENTORY")
                || HasPermission(codes, "APPROVE_SILA_TRANSFER")
                || HasPermission(codes, "MANAGE_SILA_TRANSFER");

            if (!viewReceiving)
            {
                dashboard.Kpis = new SilaReceivingDashboardKpisDto();
                dashboard.Aging = new SilaReceivingAgingDto();
                dashboard.Team = new SilaReceivingTeamDto();
                dashboard.Workbench = new List<SilaReceivingWorkbenchRowDto>();
            }

            if (!viewInvoice)
            {
                dashboard.Invoice = new SilaHomeInvoiceKpisDto();
            }

            if (!viewCreditMemo)
            {
                dashboard.CreditMemo = new SilaHomeCreditMemoKpisDto();
            }

            dashboard.Approvals = dashboard.Approvals.Where(row =>
            {
                if (row.CreditMemoId != null)
                {
                    return approveCreditMemo;
                }

                if (row.InvoiceId != null)
                {
                    return approveInvoice;
                }

                if (row.TransferId != null)
                {
                    return viewTransfer;
                }

                return false;
            }).ToList();

            HashSet<Guid> eligibleInvoiceApprovals = dashboard.Approvals
                .Where(x => x.InvoiceId != null && x.CreditMemoId == null)
                .Select(x => x.InvoiceId!.Value)
                .ToHashSet();
            HashSet<Guid> eligibleCreditMemoApprovals = dashboard.Approvals
                .Where(x => x.CreditMemoId != null)
                .Select(x => x.CreditMemoId!.Value)
                .ToHashSet();

            dashboard.Tasks = dashboard.Tasks.Where(task =>
            {
                if (IsCreditMemoTask(task))
                {
                    if (IsCreditMemoApprovalTask(task))
                    {
                        return approveCreditMemo
                            && task.CreditMemoId != null
                            && eligibleCreditMemoApprovals.Contains(task.CreditMemoId.Value);
                    }

                    return viewCreditMemo;
                }

                if (IsInvoiceTask(task))
                {
                    if (IsInvoiceApprovalTask(task))
                    {
                        return approveInvoice
                            && task.InvoiceId != null
                            && eligibleInvoiceApprovals.Contains(task.InvoiceId.Value);
                    }

                    return viewInvoice;
                }

                return viewReceiving;
            }).ToList();

            dashboard.Exceptions = dashboard.Exceptions.Where(row =>
            {
                if (row.CreditMemoId != null || StartsWith(row.Exception, "Credit memo"))
                {
                    return viewCreditMemo;
                }

                if (row.InvoiceId != null
                    || string.Equals(row.Action, "PROCESS_INVOICE", StringComparison.OrdinalIgnoreCase)
                    || StartsWith(row.Exception, "Invoice"))
                {
                    return viewInvoice;
                }

                return viewReceiving;
            }).ToList();

            dashboard.Activity = dashboard.Activity.Where(row => ActivityAllowed(row, codes)).ToList();
        }

        private static bool ActivityAllowed(SilaReceivingActivityDto row, List<string> codes)
        {
            if (row.CreditMemoId != null)
            {
                return HasPermission(codes, "VIEW_SILA_CREDIT_MEMO");
            }

            if (row.InvoiceId != null)
            {
                return HasPermission(codes, "VIEW_SILA_INVOICE");
            }

            return HasPermission(codes, "VIEW_SILA_RECEIVING");
        }

        private static bool IsInvoiceTask(SilaReceivingTaskDto task)
        {
            return task.CreditMemoId == null
                && (task.InvoiceId != null
                    || string.Equals(task.Type, "INVOICE", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(task.Type, "PROCESS_INVOICE", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(task.Action, "PROCESS_INVOICE", StringComparison.OrdinalIgnoreCase)
                    || IsInvoiceApprovalTask(task)
                    || StartsWith(task.Title, "Invoice "));
        }

        private static bool IsCreditMemoTask(SilaReceivingTaskDto task)
        {
            return task.CreditMemoId != null
                || string.Equals(task.Type, "CREDIT_MEMO", StringComparison.OrdinalIgnoreCase)
                || (task.Title != null && task.Title.Contains("credit memo", StringComparison.OrdinalIgnoreCase));
        }

        private static bool IsInvoiceApprovalTask(SilaReceivingTaskDto task)
        {
            return string.Equals(task.Title, "Approve invoice", StringComparison.OrdinalIgnoreCase)
                || (string.Equals(task.Type, "INVOICE", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(task.Status, Common.SILA_INVOICE_PENDING_APPROVAL, StringComparison.OrdinalIgnoreCase));
        }

        private static bool IsCreditMemoApprovalTask(SilaReceivingTaskDto task)
        {
            return string.Equals(task.Title, "Approve credit memo", StringComparison.OrdinalIgnoreCase)
                || (string.Equals(task.Type, "CREDIT_MEMO", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(task.Status, Common.SILA_CREDIT_MEMO_PENDING_APPROVAL, StringComparison.OrdinalIgnoreCase));
        }

        private static bool HasPermission(List<string> codes, string code)
        {
            return codes.Any(x => string.Equals(x, code, StringComparison.OrdinalIgnoreCase));
        }

        private static bool StartsWith(string? value, string prefix)
        {
            return value != null && value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsFailed(InventoryErpPosting? posting)
        {
            return posting != null && (posting.Status == Common.SILA_POSTING_FAILED || posting.Status == Common.SILA_POSTING_SKIPPED);
        }

        private static bool IsUnknown(InventoryErpPosting? posting)
        {
            return posting != null && posting.Status == Common.SILA_POSTING_UNKNOWN;
        }

        private static bool IsLocal(InventoryErpPosting? posting)
        {
            return posting != null && posting.Status == Common.SILA_POSTING_FAILED_LOCAL;
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
