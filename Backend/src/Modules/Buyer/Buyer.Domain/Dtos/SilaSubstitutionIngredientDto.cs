namespace Buyer.Domain.Dtos
{
    /// <summary>One ingredient of the recipe's approved (active) version with its stock across the property.</summary>
    public class SilaSubstitutionIngredientDto
    {
        public Guid? MaterialId { get; set; }
        public Guid? SubRecipeId { get; set; }
        public string ItemCode { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty;
        public string? MaterialGroup { get; set; }
        public decimal Quantity { get; set; }
        public string Uom { get; set; } = string.Empty;
        public decimal BaseQuantity { get; set; }
        public string BaseUom { get; set; } = string.Empty;
        public decimal? UnitCost { get; set; }
        public decimal Cost { get; set; }
        public int Sequence { get; set; }
        /// <summary>On hand across the active stores and outlets of the property, in the base unit (materials only).</summary>
        public decimal? PropertyAvailableQty { get; set; }
        /// <summary>True when the property has no stock (or less than the outlets' minimum this month).</summary>
        public bool IsShort { get; set; }
    }
}
