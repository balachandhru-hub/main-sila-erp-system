namespace Buyer.Domain.Dtos
{
    /// <summary>Headline numbers of the inventory dashboard.</summary>
    public class SilaDashboardKpisDto
    {
        /// <summary>On hand × unit cost of the balances in scope.</summary>
        public decimal StockValue { get; set; }
        /// <summary>Stocked materials at or under their threshold (reorder point, else minimum stock).</summary>
        public int LowStock { get; set; }
        /// <summary>Stocked materials with nothing on hand.</summary>
        public int OutOfStock { get; set; }
        /// <summary>Balances below zero.</summary>
        public int NegativeStock { get; set; }
        /// <summary>Transfers pending approval, approved or dispatched.</summary>
        public int OpenTransfers { get; set; }
        /// <summary>Stock counts in progress, submitted or waiting for enquiries.</summary>
        public int OpenCounts { get; set; }
        /// <summary>Alerts NEW or ACKNOWLEDGED.</summary>
        public int OpenAlerts { get; set; }

        /// <summary>A short note per KPI and whether the data it needs is configured (unit costs, stocking levels).</summary>
        public List<SilaDashboardKpiNoteDto> Notes { get; set; } = new();
    }
}
