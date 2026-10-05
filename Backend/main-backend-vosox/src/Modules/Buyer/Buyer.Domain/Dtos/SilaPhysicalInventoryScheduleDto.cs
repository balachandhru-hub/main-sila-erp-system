namespace Buyer.Domain.Dtos
{
    /// <summary>New date of a scheduled physical inventory; empty picks a random working day within the next 7 days.</summary>
    public class SilaPhysicalInventoryScheduleDto
    {
        public DateTime? ScheduledDate { get; set; }
    }
}
