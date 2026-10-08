namespace Buyer.Domain.Dtos
{
    /// <summary>The latest frozen weekly bucket of an outlet with the lines still to issue. Empty when the outlet has none.</summary>
    public class SilaGoodsIssueBucketDto
    {
        public Guid? WeeklyBucketId { get; set; }
        public string? BucketCode { get; set; }
        public string? Status { get; set; }
        public List<SilaGoodsIssueBucketLineDto> Lines { get; set; } = new();
    }
}
