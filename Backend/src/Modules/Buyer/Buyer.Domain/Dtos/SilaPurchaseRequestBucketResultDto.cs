namespace Buyer.Domain.Dtos
{
    /// <summary>The weekly bucket a purchase request was added to.</summary>
    public class SilaPurchaseRequestBucketResultDto
    {
        public Guid PurchaseRequestId { get; set; }
        public Guid WeeklyBucketId { get; set; }
        public string BucketCode { get; set; } = string.Empty;
    }
}
