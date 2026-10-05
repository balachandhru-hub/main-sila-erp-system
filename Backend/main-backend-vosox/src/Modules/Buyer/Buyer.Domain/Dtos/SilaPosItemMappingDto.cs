namespace Buyer.Domain.Dtos
{
    /// <summary>A POS item code mapped to a recipe.</summary>
    public class SilaPosItemMappingDto
    {
        public Guid Id { get; set; }
        public Guid PosSourceId { get; set; }
        public string PosItemCode { get; set; } = string.Empty;
        public string? PosItemDescription { get; set; }
        public Guid RecipeId { get; set; }
        public string? RecipeCode { get; set; }
        public string? RecipeName { get; set; }
        public string? RecipeStatus { get; set; }
        /// <summary>The approved version sold now (0 = never approved: sales of this item fail).</summary>
        public int RecipeActiveVersion { get; set; }
    }
}
