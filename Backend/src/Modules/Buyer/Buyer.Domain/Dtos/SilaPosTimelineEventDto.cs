namespace Buyer.Domain.Dtos
{
    public class SilaPosTimelineEventDto
    {
        /// <summary>
        /// RECEIVED | MATCHED | MATCH_FAILED | INVENTORY_DEDUCTED | DEDUCT_FAILED | ERP_POSTING_QUEUED | REPROCESS_REQUESTED |
        /// ERP_POSTING_REQUEUED | ERP_POSTED | ERP_FAILED | ERP_SKIPPED | ERP_UNKNOWN
        /// </summary>
        public string Action { get; set; } = string.Empty;
        public string? Comment { get; set; }
        public string? ActorName { get; set; }
        /// <summary>RECEIVE | MATCH | DEDUCT | POST | REPROCESS</summary>
        public string? Step { get; set; }
        /// <summary>DONE | FAILED | QUEUED | SKIPPED | UNKNOWN | REQUESTED</summary>
        public string? Status { get; set; }
        public DateTime OccurredOn { get; set; }
    }
}
