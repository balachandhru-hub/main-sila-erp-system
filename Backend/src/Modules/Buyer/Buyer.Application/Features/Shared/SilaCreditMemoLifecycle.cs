using Buyer.Domain.Common;

namespace Buyer.Application.Features.Shared
{
    public static class SilaCreditMemoLifecycle
    {
        public const string API_CREDIT_MEMO = "FIVE S4-INVOICE CREDITMEMO";
        public const string MISSING = "CREDIT_MEMO_POSTING_REQUIRED_FIELD_MISSING";
        public const string DOCUMENT_TYPE = "RE";
        public const string PARTNER_POSTING_TYPE = "C";

        public static readonly string[] OpenStatuses =
        {
            Common.SILA_CREDIT_MEMO_DRAFT,
            Common.SILA_CREDIT_MEMO_READY_TO_POST,
            Common.SILA_CREDIT_MEMO_POSTING_FAILED
        };

        public static readonly string[] CountsTowardRemaining =
        {
            Common.SILA_CREDIT_MEMO_DRAFT,
            Common.SILA_CREDIT_MEMO_READY_TO_POST,
            Common.SILA_CREDIT_MEMO_POSTING,
            Common.SILA_CREDIT_MEMO_POSTED,
            Common.SILA_CREDIT_MEMO_LOCAL_FAILED
        };

        public static bool CanSubmit(string status)
        {
            return status is Common.SILA_CREDIT_MEMO_DRAFT
                or Common.SILA_CREDIT_MEMO_READY_TO_POST
                or Common.SILA_CREDIT_MEMO_POSTING_FAILED;
        }

        public static bool CanRetry(string status, string? erpStatus)
        {
            return status == Common.SILA_CREDIT_MEMO_POSTING_FAILED
                || erpStatus == Common.SILA_POSTING_FAILED
                || erpStatus == Common.SILA_POSTING_SKIPPED;
        }

        public static bool IsUnknown(string status, string? erpStatus)
        {
            return status == Common.SILA_CREDIT_MEMO_POSTING_UNKNOWN || erpStatus == Common.SILA_POSTING_UNKNOWN;
        }
    }
}
