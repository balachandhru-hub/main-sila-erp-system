namespace Buyer.Domain.Dtos
{
    public class SilaRecipeIngredientDto
    {
        public Guid Id { get; set; }
        /// <summary>Recipe code + -I1, -I2 ...</summary>
        public string IngredientCode { get; set; } = string.Empty;
        public Guid? MaterialId { get; set; }
        public Guid? SubRecipeId { get; set; }
        public string ItemCode { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string Uom { get; set; } = string.Empty;
        public decimal BaseQuantity { get; set; }
        public string BaseUom { get; set; } = string.Empty;
        public decimal? UnitCost { get; set; }
        public decimal Cost { get; set; }
        public int Sequence { get; set; }
        /// <summary>Material price today: APPROVED | MISSING | PENDING_APPROVAL; empty for a sub-recipe.</summary>
        public string? PriceStatus { get; set; }
        /// <summary>The material's approved unit cost today.</summary>
        public decimal? CurrentUnitCost { get; set; }
        public string? Currency { get; set; }
        /// <summary>Unit the price is per (the material's base unit).</summary>
        public string? PriceUom { get; set; }
        /// <summary>Unit cost waiting for approval; null when no change is pending.</summary>
        public decimal? ProposedUnitPrice { get; set; }
        /// <summary>"1 CS = 12 EA": the material's conversions.</summary>
        public string? PackSummary { get; set; }
        /// <summary>A material price change can be requested (none is waiting for approval).</summary>
        public bool CanUpdatePrice { get; set; }
        public List<SilaUomConversionDto> Conversions { get; set; } = new();
        /// <summary>Readiness problem of this line, e.g. "Price missing".</summary>
        public string? Issue { get; set; }
    }
}
