namespace Buyer.Domain.Dtos
{
    public class SilaRecipeEventDto
    {
        public string Action { get; set; } = string.Empty;
        public string? Comment { get; set; }
        public Guid ActorUserId { get; set; }
        public string? ActorName { get; set; }
        public DateTime DateCreated { get; set; }
    }
}
