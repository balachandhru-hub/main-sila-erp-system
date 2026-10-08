namespace Buyer.Domain.Dtos
{
    /// <summary>One page of recipes.</summary>
    public class SilaRecipePageDto
    {
        public List<SilaRecipeListItemDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; }
    }
}
