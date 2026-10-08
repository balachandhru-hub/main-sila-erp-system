namespace Buyer.Domain.Dtos
{
    /// <summary>A user assigned to a location, with the Identity details (empty when Identity cannot be reached).</summary>
    public class SilaLocationUserDto
    {
        public Guid UserId { get; set; }
        public string? Name { get; set; }
        public string? Email { get; set; }
        public string? RoleName { get; set; }
    }
}
