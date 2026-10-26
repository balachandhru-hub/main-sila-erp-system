using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Persistent operational task and alert upsert. Deduplicates by key. Does not grant permission
    /// and does not decide approvals.
    /// </summary>
    public static class SilaOperations
    {
        public const string TASK_OPEN = "OPEN";
        public const string TASK_IN_PROGRESS = "IN_PROGRESS";
        public const string TASK_COMPLETED = "COMPLETED";
        public const string TASK_CANCELLED = "CANCELLED";

        public const string PRIORITY_CRITICAL = "CRITICAL";
        public const string PRIORITY_ACTION = "ACTION";
        public const string PRIORITY_NORMAL = "NORMAL";

        public const string ALERT_OPEN = "OPEN";
        public const string ALERT_ACKNOWLEDGED = "ACKNOWLEDGED";
        public const string ALERT_RESOLVED = "RESOLVED";

        public const string SEVERITY_CRITICAL = "CRITICAL";
        public const string SEVERITY_WARNING = "WARNING";
        public const string SEVERITY_ACTION = "ACTION";
        public const string SEVERITY_INFO = "INFO";

        public const string MODULE_RECEIVING = "RECEIVING";
        public const string EVENT_TASK = "OPERATIONAL_TASK";
        public const string EVENT_ALERT = "OPERATIONAL_ALERT";

        public sealed class TaskDraft
        {
            public required string TaskType { get; init; }
            public required string DeduplicationKey { get; init; }
            public required string Title { get; init; }
            public string? Description { get; init; }
            public string Priority { get; init; } = PRIORITY_ACTION;
            public string SourceModule { get; init; } = MODULE_RECEIVING;
            public required string SourceDocumentType { get; init; }
            public required Guid SourceDocumentId { get; init; }
            public string? SourceDocumentNumber { get; init; }
            public Guid? AssignedUserId { get; init; }
            public string? AssignedPermission { get; init; }
            public Guid? LocationId { get; init; }
            public string? ActionType { get; init; }
            public string? ActionRoute { get; init; }
            public Guid? PurchaseOrderId { get; init; }
            public Guid? GoodsReceiptId { get; init; }
            public Guid? InvoiceId { get; init; }
            public Guid? CreditMemoId { get; init; }
        }

        public sealed class AlertDraft
        {
            public required string AlertType { get; init; }
            public required string DeduplicationKey { get; init; }
            public required string Title { get; init; }
            public required string Message { get; init; }
            public string Severity { get; init; } = SEVERITY_ACTION;
            public string SourceModule { get; init; } = MODULE_RECEIVING;
            public required string SourceDocumentType { get; init; }
            public required Guid SourceDocumentId { get; init; }
            public Guid? LocationId { get; init; }
            public string? ActionRoute { get; init; }
            public Guid? PurchaseOrderId { get; init; }
            public Guid? GoodsReceiptId { get; init; }
            public Guid? InvoiceId { get; init; }
            public Guid? CreditMemoId { get; init; }
        }

        public static async Task<OperationalTask> UpsertTaskAsync(
            IRepositoryWrapper repository, Guid buyerId, Guid actorUserId, TaskDraft draft, CancellationToken cancellationToken)
        {
            OperationalTask? existing = await repository.OperationalTask.FindFirstByConditionAsync(
                x => x.BuyerId == buyerId && x.DeduplicationKey == draft.DeduplicationKey && x.IsActive);
            if (existing == null)
            {
                OperationalTask created = new OperationalTask
                {
                    Id = Guid.NewGuid(),
                    BuyerId = buyerId,
                    TaskType = draft.TaskType,
                    SourceModule = draft.SourceModule,
                    SourceDocumentType = draft.SourceDocumentType,
                    SourceDocumentId = draft.SourceDocumentId,
                    SourceDocumentNumber = draft.SourceDocumentNumber,
                    Title = draft.Title,
                    Description = draft.Description,
                    Priority = draft.Priority,
                    Status = TASK_OPEN,
                    AssignedUserId = draft.AssignedUserId,
                    AssignedPermission = draft.AssignedPermission,
                    LocationId = draft.LocationId,
                    ActionType = draft.ActionType,
                    ActionRoute = draft.ActionRoute,
                    DeduplicationKey = draft.DeduplicationKey,
                    PurchaseOrderId = draft.PurchaseOrderId,
                    GoodsReceiptId = draft.GoodsReceiptId,
                    InvoiceId = draft.InvoiceId,
                    CreditMemoId = draft.CreditMemoId,
                    IsActive = true
                };
                repository.OperationalTask.Create(created);
                Remember(repository, buyerId, actorUserId, Common.SILA_REF_OPERATIONAL_TASK, created.Id, EVENT_TASK,
                    "CREATED " + draft.DeduplicationKey);
                return created;
            }

            existing.Title = draft.Title;
            existing.Description = draft.Description;
            existing.Priority = draft.Priority;
            existing.AssignedUserId = draft.AssignedUserId ?? existing.AssignedUserId;
            existing.AssignedPermission = draft.AssignedPermission ?? existing.AssignedPermission;
            existing.ActionType = draft.ActionType ?? existing.ActionType;
            existing.ActionRoute = draft.ActionRoute ?? existing.ActionRoute;
            existing.SourceDocumentNumber = draft.SourceDocumentNumber ?? existing.SourceDocumentNumber;
            existing.PurchaseOrderId = draft.PurchaseOrderId ?? existing.PurchaseOrderId;
            existing.GoodsReceiptId = draft.GoodsReceiptId ?? existing.GoodsReceiptId;
            existing.InvoiceId = draft.InvoiceId ?? existing.InvoiceId;
            existing.CreditMemoId = draft.CreditMemoId ?? existing.CreditMemoId;
            if (existing.Status is TASK_COMPLETED or TASK_CANCELLED)
            {
                existing.Status = TASK_OPEN;
                existing.CompletedAt = null;
                existing.CompletedBy = null;
                Remember(repository, buyerId, actorUserId, Common.SILA_REF_OPERATIONAL_TASK, existing.Id, EVENT_TASK,
                    "REOPENED " + draft.DeduplicationKey);
            }

            repository.OperationalTask.Update(existing);
            return existing;
        }

        public static async Task CompleteTaskAsync(
            IRepositoryWrapper repository, OperationalTask task, Guid actorUserId, string status, string reason)
        {
            if (task.Status is TASK_COMPLETED or TASK_CANCELLED)
            {
                return;
            }

            task.Status = status;
            task.CompletedAt = DateTime.UtcNow;
            task.CompletedBy = actorUserId;
            repository.OperationalTask.Update(task);
            Remember(repository, task.BuyerId, actorUserId, Common.SILA_REF_OPERATIONAL_TASK, task.Id, EVENT_TASK,
                status + " " + task.DeduplicationKey + " " + reason);
            await Task.CompletedTask;
        }

        public static async Task<OperationalAlert> UpsertAlertAsync(
            IRepositoryWrapper repository, Guid buyerId, Guid actorUserId, AlertDraft draft, CancellationToken cancellationToken)
        {
            OperationalAlert? existing = await repository.OperationalAlert.FindFirstByConditionAsync(
                x => x.BuyerId == buyerId && x.DeduplicationKey == draft.DeduplicationKey && x.IsActive);
            if (existing == null)
            {
                OperationalAlert created = new OperationalAlert
                {
                    Id = Guid.NewGuid(),
                    BuyerId = buyerId,
                    AlertType = draft.AlertType,
                    SourceModule = draft.SourceModule,
                    SourceDocumentType = draft.SourceDocumentType,
                    SourceDocumentId = draft.SourceDocumentId,
                    Severity = draft.Severity,
                    Title = draft.Title,
                    Message = draft.Message,
                    Status = ALERT_OPEN,
                    LocationId = draft.LocationId,
                    DeduplicationKey = draft.DeduplicationKey,
                    ActionRoute = draft.ActionRoute,
                    PurchaseOrderId = draft.PurchaseOrderId,
                    GoodsReceiptId = draft.GoodsReceiptId,
                    InvoiceId = draft.InvoiceId,
                    CreditMemoId = draft.CreditMemoId,
                    IsActive = true
                };
                repository.OperationalAlert.Create(created);
                Remember(repository, buyerId, actorUserId, Common.SILA_REF_OPERATIONAL_ALERT, created.Id, EVENT_ALERT,
                    "CREATED " + draft.DeduplicationKey);
                return created;
            }

            existing.Title = draft.Title;
            existing.Message = draft.Message;
            existing.Severity = draft.Severity;
            existing.ActionRoute = draft.ActionRoute ?? existing.ActionRoute;
            if (existing.Status is ALERT_RESOLVED or ALERT_ACKNOWLEDGED)
            {
                existing.Status = ALERT_OPEN;
                existing.AcknowledgedAt = null;
                existing.AcknowledgedBy = null;
                Remember(repository, buyerId, actorUserId, Common.SILA_REF_OPERATIONAL_ALERT, existing.Id, EVENT_ALERT,
                    "REOPENED " + draft.DeduplicationKey);
            }

            repository.OperationalAlert.Update(existing);
            return existing;
        }

        public static void ResolveAlert(IRepositoryWrapper repository, OperationalAlert alert, Guid actorUserId, string reason)
        {
            if (alert.Status == ALERT_RESOLVED)
            {
                return;
            }

            alert.Status = ALERT_RESOLVED;
            alert.AcknowledgedAt ??= DateTime.UtcNow;
            alert.AcknowledgedBy ??= actorUserId;
            repository.OperationalAlert.Update(alert);
            Remember(repository, alert.BuyerId, actorUserId, Common.SILA_REF_OPERATIONAL_ALERT, alert.Id, EVENT_ALERT,
                "RESOLVED " + alert.DeduplicationKey + " " + reason);
        }

        public static async Task CompleteOpenExceptAsync(
            IRepositoryWrapper repository, Guid buyerId, Guid actorUserId, HashSet<string> keepKeys, CancellationToken cancellationToken)
        {
            List<OperationalTask> open = await repository.OperationalTask
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive
                    && (x.Status == TASK_OPEN || x.Status == TASK_IN_PROGRESS)
                    && x.SourceModule == MODULE_RECEIVING)
                .ToListAsync(cancellationToken);
            foreach (OperationalTask task in open.Where(x => !keepKeys.Contains(x.DeduplicationKey)))
            {
                await CompleteTaskAsync(repository, task, actorUserId, TASK_COMPLETED, "Condition resolved.");
            }

            List<OperationalAlert> alerts = await repository.OperationalAlert
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == ALERT_OPEN
                    && x.SourceModule == MODULE_RECEIVING)
                .ToListAsync(cancellationToken);
            foreach (OperationalAlert alert in alerts.Where(x => !keepKeys.Contains(x.DeduplicationKey)))
            {
                ResolveAlert(repository, alert, actorUserId, "Condition resolved.");
            }
        }

        public static async Task OnApprovalStepAsync(
            IRepositoryWrapper repository, SilaApprovalStep step, string documentNumber, CancellationToken cancellationToken)
        {
            string key = "APPROVAL_REQUIRED:" + step.Id.ToString("D");
            await UpsertTaskAsync(repository, step.BuyerId, step.UserId, new TaskDraft
            {
                TaskType = "APPROVAL_REQUIRED",
                DeduplicationKey = key,
                Title = "Approval required",
                Description = step.ApprovalType + " " + documentNumber,
                Priority = PRIORITY_ACTION,
                SourceDocumentType = step.ReferenceType,
                SourceDocumentId = step.ReferenceId,
                SourceDocumentNumber = documentNumber,
                AssignedUserId = step.UserId,
                ActionType = "REVIEW",
                ActionRoute = RouteOf(step.ReferenceType, step.ReferenceId),
                InvoiceId = step.ReferenceType == Common.SILA_REF_INVOICE ? step.ReferenceId : null,
                CreditMemoId = step.ReferenceType == Common.SILA_REF_CREDIT_MEMO ? step.ReferenceId : null
            }, cancellationToken);
            await UpsertAlertAsync(repository, step.BuyerId, step.UserId, new AlertDraft
            {
                AlertType = "APPROVAL_REQUIRED",
                DeduplicationKey = key,
                Title = "Approval required",
                Message = step.ApprovalType + " " + documentNumber + " is waiting for approval.",
                Severity = SEVERITY_ACTION,
                SourceDocumentType = step.ReferenceType,
                SourceDocumentId = step.ReferenceId,
                ActionRoute = RouteOf(step.ReferenceType, step.ReferenceId),
                InvoiceId = step.ReferenceType == Common.SILA_REF_INVOICE ? step.ReferenceId : null,
                CreditMemoId = step.ReferenceType == Common.SILA_REF_CREDIT_MEMO ? step.ReferenceId : null
            }, cancellationToken);
        }

        public static async Task CompleteApprovalStepAsync(
            IRepositoryWrapper repository, SilaApprovalStep step, Guid actorUserId, CancellationToken cancellationToken)
        {
            string key = "APPROVAL_REQUIRED:" + step.Id.ToString("D");
            OperationalTask? task = await repository.OperationalTask.FindFirstByConditionAsync(
                x => x.BuyerId == step.BuyerId && x.DeduplicationKey == key && x.IsActive);
            if (task != null)
            {
                await CompleteTaskAsync(repository, task, actorUserId, TASK_COMPLETED, "Approval decided.");
            }

            OperationalAlert? alert = await repository.OperationalAlert.FindFirstByConditionAsync(
                x => x.BuyerId == step.BuyerId && x.DeduplicationKey == key && x.IsActive);
            if (alert != null)
            {
                ResolveAlert(repository, alert, actorUserId, "Approval decided.");
            }
        }

        public static string RouteOf(string referenceType, Guid id)
        {
            if (referenceType == Common.SILA_REF_INVOICE)
            {
                return "receive/invoices/" + id.ToString("D");
            }

            if (referenceType == Common.SILA_REF_CREDIT_MEMO)
            {
                return "receive/credit-memos/" + id.ToString("D");
            }

            if (referenceType == Common.SILA_REF_GRN || referenceType == Common.SILA_REF_GRN_REVERSAL)
            {
                return "receive/grns/" + id.ToString("D");
            }

            return "receive";
        }

        public static string ScreenPriority(string priority)
        {
            return priority == PRIORITY_CRITICAL ? "CRITICAL" : "ACTION_REQUIRED";
        }

        public static string ScreenSeverity(string severity)
        {
            return severity == SEVERITY_CRITICAL ? "CRITICAL" : "ACTION_REQUIRED";
        }

        private static void Remember(
            IRepositoryWrapper repository, Guid buyerId, Guid userId, string referenceType, Guid referenceId, string action, string comment)
        {
            repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = buyerId,
                ReferenceType = referenceType,
                ReferenceId = referenceId,
                Action = action,
                Comment = comment.Length > 1000 ? comment[..1000] : comment,
                ActorUserId = userId,
                IsActive = true
            });
        }
    }
}
