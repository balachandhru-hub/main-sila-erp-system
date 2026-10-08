namespace Buyer.Domain.Dtos
{
    /// <summary>The users assigned to one inventory location.</summary>
    public class SilaLocationUsersDto
    {
        public Guid LocationId { get; set; }
        public List<Guid> UserIds { get; set; } = new();

        /// <summary>The same users with name, email and role.</summary>
        public List<SilaLocationUserDto> Users { get; set; } = new();
    }
}
