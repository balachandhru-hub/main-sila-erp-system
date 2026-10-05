namespace Buyer.Application.Features.Shared
{
    /// <summary>The result of one approver's decision: still pending (more levels), approved (last level) or rejected.</summary>
    public class ApprovalDecision
    {
        public string Outcome { get; set; } = string.Empty;

        public int Level { get; set; }

        public bool IsFinal => Outcome != SilaApprovals.OUTCOME_PENDING;
    }
}
