namespace Buyer.Domain.Dtos
{
    /// <summary>One page of ingredient search results.</summary>
    public class SilaRecipeIngredientPageDto
    {
        public List<SilaRecipeIngredientOptionDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; }
    }
}
