namespace Buyer.Domain.Dtos
{
    public class SilaTransferEventDto
    {
        public string Action { get; set; } = string.Empty;
        public string? Comment { get; set; }
        public Guid ActorUserId { get; set; }

        /// <summary>Display name of the actor, or the user id when Identity cannot resolve it.</summary>
        public string ActorName { get; set; } = string.Empty;
        public DateTime On { get; set; }
    }
}
