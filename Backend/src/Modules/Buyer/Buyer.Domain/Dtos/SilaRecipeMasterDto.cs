namespace Buyer.Domain.Dtos
{
    /// <summary>A recipe family or category (master data).</summary>
    public class SilaRecipeMasterDto
    {
        public Guid Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        /// <summary>Active recipes that use it.</summary>
        public int RecipeCount { get; set; }
        /// <summary>ACTIVE, or INACTIVE for a deleted master (listed with status=INACTIVE or ALL).</summary>
        public string Status { get; set; } = "ACTIVE";
    }
}
