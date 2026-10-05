namespace Buyer.Domain.Dtos
{
    /// <summary>A recipe sold at a POS outlet: its active version's menu price there, its costing and its POS item mapping.</summary>
    public class SilaPosOutletMenuItemDto
    {
        public Guid RecipeId { get; set; }
        public string RecipeCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? PosCode { get; set; }
        public string? PosItem { get; set; }
        public int ActiveVersion { get; set; }
        public decimal MenuPrice { get; set; }
        public string? Currency { get; set; }
        /// <summary>Cost of one serving of the active version.</summary>
        public decimal CostPerServing { get; set; }
        public decimal? CostPercent { get; set; }
        public decimal? MarginPercent { get; set; }
        /// <summary>The POS item of this POS source mapped to the recipe; null when the recipe is matched by its POS code only.</summary>
        public Guid? PosItemMappingId { get; set; }
        public string? PosItemCode { get; set; }
        public string? PosItemDescription { get; set; }
        public DateTime? LastSaleDate { get; set; }
    }
}
