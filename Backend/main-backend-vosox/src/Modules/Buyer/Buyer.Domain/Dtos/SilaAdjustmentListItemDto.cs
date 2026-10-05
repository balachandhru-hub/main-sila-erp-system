namespace Buyer.Domain.Dtos
{
    public class SilaAdjustmentListItemDto
    {
        public Guid Id { get; set; }
        public string AdjustmentNumber { get; set; } = string.Empty;
        public Guid LocationId { get; set; }
        public string? LocationName { get; set; }
        public string AdjustmentType { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public Guid PostedBy { get; set; }
        public string? PostedByName { get; set; }
        public DateTime PostedOn { get; set; }
        public int LineCount { get; set; }
    }
}
