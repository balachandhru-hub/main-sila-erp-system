using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

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
            Common.SILA_CREDIT_MEMO_PENDING_APPROVAL,
            Common.SILA_CREDIT_MEMO_APPROVAL_REJECTED,
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
                or Common.SILA_CREDIT_MEMO_APPROVAL_REJECTED
                or Common.SILA_CREDIT_MEMO_POSTING_FAILED;
        }

        public static bool CanRetry(string status, string? erpStatus)
        {
            return status == Common.SILA_CREDIT_MEMO_POSTING_FAILED
                || erpStatus == Common.SILA_POSTING_FAILED
                || erpStatus == Common.SILA_POSTING_SKIPPED;
        }

        public static async Task<bool> ApprovalConfiguredAsync(IRepositoryWrapper repository, Guid buyerId, CancellationToken cancellationToken)
        {
            return await repository.MasterApprovalFlow
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Type != null
                    && x.Type.ToUpper() == Common.SILA_APPROVAL_TYPE_CREDIT_MEMO)
                .AnyAsync(cancellationToken);
        }

        public static async Task<bool> ApprovalCompleteAsync(IRepositoryWrapper repository, Guid creditMemoId, CancellationToken cancellationToken)
        {
            List<SilaApprovalStep> steps = await repository.SilaApprovalStep
                .FindByCondition(x => x.ReferenceType == Common.SILA_REF_CREDIT_MEMO && x.ReferenceId == creditMemoId && x.IsActive)
                .ToListAsync(cancellationToken);
            if (steps.Count == 0 || steps.Any(x => x.Status == Common.SILA_APPROVAL_PENDING))
            {
                return false;
            }

            int version = steps.Max(x => x.Version);
            return steps.Where(x => x.Version == version).All(x => x.Status == Common.SILA_APPROVAL_APPROVED);
        }

        public static bool IsUnknown(string status, string? erpStatus)
        {
            return status == Common.SILA_CREDIT_MEMO_POSTING_UNKNOWN || erpStatus == Common.SILA_POSTING_UNKNOWN;
        }
    }
}
