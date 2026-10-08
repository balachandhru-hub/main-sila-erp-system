namespace Buyer.Domain.Dtos
{
    /// <summary>Note of one dashboard KPI; an unconfigured KPI shows "Not configured" instead of its value.</summary>
    public class SilaDashboardKpiNoteDto
    {
        /// <summary>STOCK_VALUE | LOW_STOCK | OUT_OF_STOCK | NEGATIVE_STOCK | OPEN_TRANSFERS | OPEN_COUNTS | OPEN_ALERTS</summary>
        public string Key { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;
        public bool Configured { get; set; }
    }
}
