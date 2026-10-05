namespace Buyer.Application.Features.Shared
{
    /// <summary>The stocking levels of a material at a location for one month: a month override replaces the base level.</summary>
    public class SilaEffectiveLevels
    {
        public decimal? MinimumStock { get; set; }
        public decimal? ReorderPoint { get; set; }
        public decimal? ParLevel { get; set; }

        /// <summary>The level under which the material needs replenishment: the reorder point, else the minimum stock.</summary>
        public decimal? Threshold => ReorderPoint ?? MinimumStock;
    }
}
