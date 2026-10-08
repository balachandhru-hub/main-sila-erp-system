namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A material in stock in the property that can replace a short ingredient: the line it would become (quantity and unit
    /// copied from the replaced ingredient, converted when the units differ) and the recipe cost and margins if chosen.
    /// </summary>
    public class SilaSubstitutionSuggestionDto
    {
        /// <summary>The ingredient material this suggestion replaces.</summary>
        public Guid ReplacesMaterialId { get; set; }
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? MaterialGroup { get; set; }
        public string BaseUom { get; set; } = string.Empty;
        public decimal? UnitCost { get; set; }
        public string? Currency { get; set; }
        public decimal PropertyAvailableQty { get; set; }
        public decimal Quantity { get; set; }
        public string Uom { get; set; } = string.Empty;
        public decimal BaseQuantity { get; set; }
        public decimal LineCost { get; set; }
        /// <summary>LineCost minus the cost of the replaced line.</summary>
        public decimal CostDelta { get; set; }
        /// <summary>Total recipe cost with only this replacement.</summary>
        public decimal ResultTotalCost { get; set; }
        /// <summary>The best candidate for its ingredient.</summary>
        public bool IsRecommended { get; set; }
        public List<SilaSubstitutionOutletDto> Outlets { get; set; } = new();
    }
}
