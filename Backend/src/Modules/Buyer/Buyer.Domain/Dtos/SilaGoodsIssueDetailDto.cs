namespace Buyer.Domain.Dtos
{
    public class SilaGoodsIssueDetailDto
    {
        public Guid Id { get; set; }
        public string IssueNumber { get; set; } = string.Empty;
        public Guid FromLocationId { get; set; }
        public string? FromLocationName { get; set; }
        public Guid ToLocationId { get; set; }
        public string? ToLocationName { get; set; }
        public Guid? WeeklyBucketId { get; set; }
        public string? BucketCode { get; set; }
        public Guid IssuedBy { get; set; }
        public string? IssuedByName { get; set; }
        public DateTime IssuedOn { get; set; }
        public string? Comment { get; set; }
        public List<SilaGoodsIssueItemDto> Items { get; set; } = new();
    }
}
