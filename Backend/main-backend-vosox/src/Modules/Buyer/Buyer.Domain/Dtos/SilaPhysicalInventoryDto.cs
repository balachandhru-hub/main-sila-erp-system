namespace Buyer.Domain.Dtos
{
    /// <summary>A physical inventory request: a surprise blind count scheduled at a location.</summary>
    public class SilaPhysicalInventoryDto
    {
        public Guid Id { get; set; }
        public string RequestNumber { get; set; } = string.Empty;
        public Guid LocationId { get; set; }
        public string? LocationName { get; set; }
        public Guid? AlertId { get; set; }
        public string? AlertTitle { get; set; }
        public string Reason { get; set; } = string.Empty;
        public DateTime ScheduledDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public Guid? StockCountId { get; set; }
        public string? CountNumber { get; set; }
        public string? CountStatus { get; set; }
        public Guid RequestedBy { get; set; }
        public Guid? AssignedUserId { get; set; }
        public DateTime DateCreated { get; set; }
    }
}
