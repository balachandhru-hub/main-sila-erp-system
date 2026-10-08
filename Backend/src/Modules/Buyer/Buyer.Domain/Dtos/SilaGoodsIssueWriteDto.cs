namespace Buyer.Domain.Dtos
{
    /// <summary>Goods issue from a store to an outlet of the same property, optionally against a weekly bucket.</summary>
    public class SilaGoodsIssueWriteDto
    {
        public Guid FromLocationId { get; set; }
        public Guid ToLocationId { get; set; }
        public Guid? WeeklyBucketId { get; set; }
        public string? Comment { get; set; }
        public List<SilaGoodsIssueLineWriteDto> Items { get; set; } = new();
    }
}
