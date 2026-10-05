namespace Buyer.Domain.Dtos
{
    /// <summary>A version of a recipe: ACTIVE (selling), DRAFT, PENDING_APPROVAL, REJECTED or SUPERSEDED.</summary>
    public class SilaRecipeVersionDto
    {
        public int Version { get; set; }
        public string Status { get; set; } = string.Empty;
    }
}
