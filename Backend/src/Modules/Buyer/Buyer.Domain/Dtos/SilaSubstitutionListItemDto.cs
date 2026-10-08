namespace Buyer.Domain.Dtos
{
    /// <summary>A proposal of the system to replace a short ingredient of an approved recipe with a material in stock.</summary>
    public class SilaSubstitutionListItemDto
    {
        public Guid Id { get; set; }
        public string ProposalNumber { get; set; } = string.Empty;
        /// <summary>PROPOSED | ACCEPTED | DISMISSED</summary>
        public string Status { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public Guid RecipeId { get; set; }
        public string RecipeCode { get; set; } = string.Empty;
        public string RecipeName { get; set; } = string.Empty;
        public Guid IngredientMaterialId { get; set; }
        public string IngredientCode { get; set; } = string.Empty;
        public string IngredientName { get; set; } = string.Empty;
        public Guid SuggestedMaterialId { get; set; }
        public string SuggestedCode { get; set; } = string.Empty;
        public string SuggestedName { get; set; } = string.Empty;
        public Guid? LocationId { get; set; }
        public string? LocationName { get; set; }
        public string? PropertyName { get; set; }
        /// <summary>The recipe version the accepted proposal created.</summary>
        public int? CreatedVersion { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DecidedOn { get; set; }
    }
}
