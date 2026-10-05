namespace Buyer.Domain.Dtos
{
    /// <summary>A month override of a stocking row: replaces the minimum stock and/or reorder point in that month.</summary>
    public class SilaMonthlyThresholdDto
    {
        /// <summary>1 (January) to 12 (December).</summary>
        public int Month { get; set; }
        public decimal? MinimumStock { get; set; }
        public decimal? ReorderPoint { get; set; }
    }
}
