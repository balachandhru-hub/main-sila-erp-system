namespace Buyer.Domain.Dtos
{
    /// <summary>One stocking row of a location.</summary>
    public class SilaLocationMaterialItemWriteDto
    {
        public Guid MaterialId { get; set; }
        public decimal? MinimumStock { get; set; }
        public decimal? ParLevel { get; set; }
        public decimal? ReorderPoint { get; set; }

        /// <summary>REGULAR | ON_DEMAND; empty keeps the saved type (REGULAR for a new row).</summary>
        public string? StockingType { get; set; }
        public decimal? MaximumStock { get; set; }
        public decimal? SafetyStock { get; set; }
        /// <summary>Month overrides; null keeps the saved overrides, an empty list removes them.</summary>
        public List<SilaMonthlyThresholdDto>? MonthlyThresholds { get; set; }
    }
}
