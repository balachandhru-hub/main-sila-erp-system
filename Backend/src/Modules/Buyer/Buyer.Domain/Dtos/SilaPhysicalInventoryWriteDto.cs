namespace Buyer.Domain.Dtos
{
    /// <summary>Request a physical inventory. Without a date a random working day within the next 7 days is chosen.</summary>
    public class SilaPhysicalInventoryWriteDto
    {
        public Guid LocationId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public DateTime? ScheduledDate { get; set; }
        public Guid? AssignedUserId { get; set; }
    }
}
