namespace Buyer.Domain.Dtos
{
    /// <summary>One ingredient: an Item Master material, or (BATCH only) another approved recipe.</summary>
    public class SilaRecipeIngredientWriteDto
    {
        public Guid? MaterialId { get; set; }
        public Guid? SubRecipeId { get; set; }
        public decimal Quantity { get; set; }
        /// <summary>Ingredient unit, e.g. ML. A sub-recipe is measured in its serving unit.</summary>
        public string? Uom { get; set; }
    }
}
