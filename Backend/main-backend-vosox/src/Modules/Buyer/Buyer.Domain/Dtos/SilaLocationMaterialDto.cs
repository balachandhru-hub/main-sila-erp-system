namespace Buyer.Domain.Dtos
{
    /// <summary>A stocking row of a location: the levels a material is kept at.</summary>
    public class SilaLocationMaterialDto
    {
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string BaseUom { get; set; } = string.Empty;
        public decimal? MinimumStock { get; set; }
        public decimal? ParLevel { get; set; }
        public decimal? ReorderPoint { get; set; }

        /// <summary>REGULAR | ON_DEMAND</summary>
        public string StockingType { get; set; } = string.Empty;
        public decimal? MaximumStock { get; set; }
        public decimal? SafetyStock { get; set; }
        public bool Active { get; set; } = true;
        /// <summary>Current on hand quantity at the location, in the base unit.</summary>
        public decimal OnHandQty { get; set; }
        /// <summary>Month overrides of the minimum stock and reorder point.</summary>
        public List<SilaMonthlyThresholdDto> MonthlyThresholds { get; set; } = new();
    }
}
