namespace Buyer.Domain.Dtos
{
    /// <summary>Something a recipe user should do next.</summary>
    public class SilaRecipeNextActionDto
    {
        /// <summary>NOT_READY | AWAITING_ME | FAILED_POS</summary>
        public string Kind { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Detail { get; set; }
        /// <summary>The recipe or POS transaction.</summary>
        public Guid? ReferenceId { get; set; }
    }
}
