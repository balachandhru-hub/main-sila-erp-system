namespace Buyer.Domain.Dtos
{
    public class SilaPosItemMappingWriteDto
    {
        public string PosItemCode { get; set; } = string.Empty;
        public string? PosItemDescription { get; set; }
        public Guid RecipeId { get; set; }
    }
}
