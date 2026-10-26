using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Writes the current receiving dashboard conditions into operational tasks and alerts,
    /// then completes rows whose condition is gone. Does not call SAP.
    /// </summary>
    public static class SilaOperationsSync
    {
        public static async Task ApplyDashboardAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            Guid userId,
            SilaReceivingDashboardDto dashboard,
            CancellationToken cancellationToken)
        {
            HashSet<string> keep = new HashSet<string>(StringComparer.Ordinal);
            foreach (SilaReceivingTaskDto task in dashboard.Tasks)
            {
                string key = KeyOf(task);
                keep.Add(key);
                await SilaOperations.UpsertTaskAsync(repository, buyerId, userId, new SilaOperations.TaskDraft
                {
                    TaskType = NormalizeType(task.Type, task.Status, task.Action),
                    DeduplicationKey = key,
                    Title = task.Title,
                    Priority = task.Priority == "CRITICAL" ? SilaOperations.PRIORITY_CRITICAL : SilaOperations.PRIORITY_ACTION,
                    SourceDocumentType = DocumentTypeOf(task),
                    SourceDocumentId = DocumentIdOf(task),
                    SourceDocumentNumber = task.GrnNumber ?? task.PoNumber,
                    LocationId = null,
                    ActionType = task.Action,
                    ActionRoute = RouteOf(task),
                    PurchaseOrderId = task.PurchaseOrderId,
                    GoodsReceiptId = task.GoodsReceiptId,
                    InvoiceId = task.InvoiceId,
                    CreditMemoId = task.CreditMemoId
                }, cancellationToken);
            }

            foreach (SilaReceivingExceptionDto row in dashboard.Exceptions)
            {
                string key = AlertKeyOf(row);
                keep.Add(key);
                await SilaOperations.UpsertAlertAsync(repository, buyerId, userId, new SilaOperations.AlertDraft
                {
                    AlertType = AlertTypeOf(row),
                    DeduplicationKey = key,
                    Title = row.Exception,
                    Message = row.Message ?? row.Exception,
                    Severity = row.Severity == "CRITICAL" ? SilaOperations.SEVERITY_CRITICAL : SilaOperations.SEVERITY_ACTION,
                    SourceDocumentType = row.CreditMemoId != null ? Common.SILA_REF_CREDIT_MEMO
                        : row.InvoiceId != null ? Common.SILA_REF_INVOICE
                        : row.GoodsReceiptId != null ? Common.SILA_REF_GRN
                        : Common.SILA_REF_PO,
                    SourceDocumentId = row.CreditMemoId ?? row.InvoiceId ?? row.GoodsReceiptId ?? row.PurchaseOrderId ?? Guid.Empty,
                    ActionRoute = AlertRouteOf(row),
                    PurchaseOrderId = row.PurchaseOrderId,
                    GoodsReceiptId = row.GoodsReceiptId,
                    InvoiceId = row.InvoiceId,
                    CreditMemoId = row.CreditMemoId
                }, cancellationToken);
            }

            await SilaOperations.CompleteOpenExceptAsync(repository, buyerId, userId, keep, cancellationToken);
            await repository.SaveAsync();
        }

        private static string KeyOf(SilaReceivingTaskDto task)
        {
            string type = NormalizeType(task.Type, task.Status, task.Action);
            Guid id = task.CreditMemoId ?? task.InvoiceId ?? task.GoodsReceiptId ?? task.PurchaseOrderId ?? Guid.Empty;
            if (type == "PROCESS_INVOICE" && task.GoodsReceiptId != null)
            {
                return "PROCESS_INVOICE:" + task.GoodsReceiptId.Value.ToString("D");
            }

            if ((type is "RETRY_INVOICE" or "RECONCILE_INVOICE" or "COMPLETE_INVOICE_LOCAL_FINALIZATION") && task.InvoiceId != null)
            {
                return type + ":" + task.InvoiceId.Value.ToString("D");
            }

            if ((type is "RETRY_CREDIT_MEMO" or "RECONCILE_CREDIT_MEMO" or "COMPLETE_CREDIT_MEMO_LOCAL_FINALIZATION") && task.CreditMemoId != null)
            {
                return type + ":" + task.CreditMemoId.Value.ToString("D");
            }

            if (type == "APPROVAL_REQUIRED" || type == "APPROVE_INVOICE")
            {
                return type + ":" + id.ToString("D");
            }

            return type + ":" + id.ToString("D");
        }

        private static string AlertKeyOf(SilaReceivingExceptionDto row)
        {
            return AlertTypeOf(row) + ":" + (row.CreditMemoId ?? row.InvoiceId ?? row.GoodsReceiptId ?? row.PurchaseOrderId ?? Guid.Empty).ToString("D");
        }

        private static string NormalizeType(string type, string? status, string action)
        {
            if (type == "PROCESS_INVOICE")
            {
                return "PROCESS_INVOICE";
            }

            if (type == "GRN_FAILED")
            {
                return "GRN_FAILED";
            }

            if (type == "GRN_UNKNOWN")
            {
                return "GRN_POSTING_UNKNOWN";
            }

            if (type == "GRN_LOCAL")
            {
                return "COMPLETE_GRN_LOCAL_FINALIZATION";
            }

            if (type == "OVERDUE" || type == "EXPECTED_TODAY")
            {
                return "RECEIVE_PO";
            }

            if (type == "PARTIAL")
            {
                return "RECEIVE_BALANCE";
            }

            if (type == "CREDIT_MEMO")
            {
                if (status == Common.SILA_CREDIT_MEMO_POSTING_UNKNOWN)
                {
                    return "RECONCILE_CREDIT_MEMO";
                }

                if (status == Common.SILA_CREDIT_MEMO_LOCAL_FAILED)
                {
                    return "COMPLETE_CREDIT_MEMO_LOCAL_FINALIZATION";
                }

                if (status == Common.SILA_CREDIT_MEMO_PENDING_APPROVAL)
                {
                    return "APPROVAL_REQUIRED";
                }

                return status == Common.SILA_CREDIT_MEMO_POSTING_FAILED ? "RETRY_CREDIT_MEMO" : "REVIEW_CREDIT_MEMO";
            }

            if (type == "INVOICE")
            {
                if (status == Common.SILA_INVOICE_POSTING_UNKNOWN)
                {
                    return "RECONCILE_INVOICE";
                }

                if (status == Common.SILA_INVOICE_LOCAL_FAILED)
                {
                    return "COMPLETE_INVOICE_LOCAL_FINALIZATION";
                }

                if (status == Common.SILA_INVOICE_PENDING_APPROVAL)
                {
                    return "APPROVE_INVOICE";
                }

                if (status == Common.SILA_INVOICE_POSTING_FAILED)
                {
                    return "RETRY_INVOICE";
                }

                return "REVIEW_INVOICE";
            }

            return string.IsNullOrWhiteSpace(type) ? action : type;
        }

        private static string AlertTypeOf(SilaReceivingExceptionDto row)
        {
            string text = row.Exception.ToUpperInvariant();
            if (text.Contains("GRN POSTING UNKNOWN"))
            {
                return "GRN_POSTING_UNKNOWN";
            }

            if (text.Contains("GRN POSTING FAILED") || text.Contains("GRN REVERSAL FAILED"))
            {
                return text.Contains("REVERSAL") ? "GRN_REVERSAL_FAILED" : "GRN_POSTING_FAILED";
            }

            if (text.Contains("OVERDUE"))
            {
                return "EXPECTED_PO_OVERDUE";
            }

            if (text.Contains("PARTIAL"))
            {
                return "PARTIAL_RECEIPT_OUTSTANDING";
            }

            if (text.Contains("INVOICE") && text.Contains("UNKNOWN"))
            {
                return "INVOICE_POSTING_UNKNOWN";
            }

            if (text.Contains("INVOICE") && text.Contains("VALID"))
            {
                return "INVOICE_VALIDATION_FAILED";
            }

            if (text.Contains("INVOICE") && text.Contains("READY"))
            {
                return "INVOICE_READY_FOR_PROCESSING";
            }

            if (text.Contains("INVOICE"))
            {
                return "INVOICE_POSTING_FAILED";
            }

            if (text.Contains("CREDIT") && text.Contains("UNKNOWN"))
            {
                return "CREDIT_MEMO_POSTING_UNKNOWN";
            }

            if (text.Contains("CREDIT"))
            {
                return "CREDIT_MEMO_FAILED";
            }

            if (text.Contains("APPROVAL"))
            {
                return "APPROVAL_REQUIRED";
            }

            return "ACTION";
        }

        private static string DocumentTypeOf(SilaReceivingTaskDto task)
        {
            if (task.CreditMemoId != null)
            {
                return Common.SILA_REF_CREDIT_MEMO;
            }

            if (task.InvoiceId != null)
            {
                return Common.SILA_REF_INVOICE;
            }

            if (task.GoodsReceiptId != null)
            {
                return Common.SILA_REF_GRN;
            }

            return Common.SILA_REF_PO;
        }

        private static Guid DocumentIdOf(SilaReceivingTaskDto task)
        {
            return task.CreditMemoId ?? task.InvoiceId ?? task.GoodsReceiptId ?? task.PurchaseOrderId ?? Guid.Empty;
        }

        private static string RouteOf(SilaReceivingTaskDto task)
        {
            if (task.Action == "PROCESS_INVOICE" && task.GoodsReceiptId != null)
            {
                return "receive/scan";
            }

            if (task.CreditMemoId != null)
            {
                return "receive/credit-memos/" + task.CreditMemoId.Value.ToString("D");
            }

            if (task.InvoiceId != null)
            {
                return "receive/invoices/" + task.InvoiceId.Value.ToString("D");
            }

            if (task.GoodsReceiptId != null)
            {
                return "receive/grns/" + task.GoodsReceiptId.Value.ToString("D");
            }

            if (task.PurchaseOrderId != null && (task.Action == "RECEIVE" || task.Action == "RECEIVE_BALANCE"))
            {
                return "receive/grn/new?poId=" + task.PurchaseOrderId.Value.ToString("D");
            }

            return "receive";
        }

        private static string AlertRouteOf(SilaReceivingExceptionDto row)
        {
            if (row.CreditMemoId != null)
            {
                return "receive/credit-memos/" + row.CreditMemoId.Value.ToString("D");
            }

            if (row.InvoiceId != null)
            {
                return "receive/invoices/" + row.InvoiceId.Value.ToString("D");
            }

            if (row.GoodsReceiptId != null)
            {
                return "receive/grns/" + row.GoodsReceiptId.Value.ToString("D");
            }

            if (row.PurchaseOrderId != null)
            {
                return "receive/pos/" + row.PurchaseOrderId.Value.ToString("D");
            }

            return "receive";
        }
    }
}
