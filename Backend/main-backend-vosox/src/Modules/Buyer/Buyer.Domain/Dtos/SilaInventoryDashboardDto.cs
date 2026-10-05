namespace Buyer.Domain.Dtos
{
    /// <summary>The inventory control center of the locations in scope (the caller's, narrowed by the filters).</summary>
    public class SilaInventoryDashboardDto
    {
        /// <summary>Currency of the values, when the materials in scope share one.</summary>
        public string? Currency { get; set; }
        /// <summary>Month (1-12) whose stocking-level overrides were applied.</summary>
        public int Month { get; set; }
        public SilaDashboardKpisDto Kpis { get; set; } = new();
        public SilaStockHealthDto Health { get; set; } = new();
        public List<SilaDashboardActionDto> Actions { get; set; } = new();
        public List<SilaReplenishmentRowDto> Replenishment { get; set; } = new();
        public List<SilaMovementBucketDto> MovementToday { get; set; } = new();
        public List<SilaTransferStageDto> TransferStages { get; set; } = new();
        public List<SilaLocationValueDto> ValueByLocation { get; set; } = new();
        public List<SilaConsumptionRowDto> TopConsumption { get; set; } = new();
    }
}
