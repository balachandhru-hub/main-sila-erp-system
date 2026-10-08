namespace Buyer.Domain.Dtos
{
    public class WeeklyBucketDetailDto
    {
        /// <summary>
        /// Null when the bucket of the week has not been created yet.
        /// </summary>
        public Guid? Id { get; set; }
        public string BucketCode { get; set; } = string.Empty;
        public int WeekNumber { get; set; }
        public int Year { get; set; }
        public Guid PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public string PlantCode { get; set; } = string.Empty;
        public string CompanyCode { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public bool IsFrozen { get; set; }
        public Guid? FrozenBy { get; set; }
        public string? FrozenByName { get; set; }
        public DateTime? FrozenOn { get; set; }
        public DateTime? FinalApprovedOn { get; set; }
        public string? ApprovalName { get; set; }
        public string? LastError { get; set; }
        /// <summary>When the weekend of this bucket's week starts: purchase orders of an approved bucket are created automatically from then.</summary>
        public DateTime WeekendStartsOn { get; set; }
        /// <summary>Shown in the app while the bucket is still open and the reminder period of its week has started. Null otherwise.</summary>
        public string? FreezeReminder { get; set; }
        /// <summary>True when the bucket is approved and its purchase orders have not been created yet: the store manager can use Quick Create.</summary>
        public bool QuickCreateAvailable { get; set; }
        public List<WeeklyBucketItemDto> Items { get; set; } = new();
        public List<WeeklyBucketRecommendationDto> Recommendations { get; set; } = new();
        public List<WeeklyBucketApprovalStepDto> ApprovalSteps { get; set; } = new();
        public List<WeeklyBucketPurchaseOrderDto> PurchaseOrders { get; set; } = new();
        public List<WeeklyBucketAuditDto> Audit { get; set; } = new();
    }
}
