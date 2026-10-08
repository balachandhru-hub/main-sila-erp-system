namespace Buyer.Domain.Dtos
{
    /// <summary>Replaces the users assigned to a location.</summary>
    public class SilaLocationUsersWriteDto
    {
        public List<Guid> UserIds { get; set; } = new();
    }
}
