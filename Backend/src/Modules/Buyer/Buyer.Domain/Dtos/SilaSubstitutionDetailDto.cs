namespace Buyer.Domain.Dtos
{
    /// <summary>A substitution proposal with the recipe's active ingredients, the short ones and the suggestions in stock.</summary>
    public class SilaSubstitutionDetailDto
    {
        public SilaSubstitutionListItemDto Proposal { get; set; } = new();
        public Guid RecipeId { get; set; }
        public string RecipeCode { get; set; } = string.Empty;
        public string RecipeName { get; set; } = string.Empty;
        public string ItemMode { get; set; } = string.Empty;
        public string RecipeStatus { get; set; } = string.Empty;
        public int ActiveVersion { get; set; }
        public int LatestVersion { get; set; }
        /// <summary>True when a newer version is waiting for approval or being edited (the proposal cannot be accepted now).</summary>
        public bool HasPendingVersion { get; set; }
        public string? Currency { get; set; }
        public decimal TotalCost { get; set; }
        public Guid? PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public List<SilaSubstitutionIngredientDto> Ingredients { get; set; } = new();
        public List<SilaSubstitutionSuggestionDto> Suggestions { get; set; } = new();
        public List<SilaSubstitutionOutletDto> Outlets { get; set; } = new();
    }
}
