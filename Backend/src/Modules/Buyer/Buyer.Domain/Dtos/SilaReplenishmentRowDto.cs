namespace Buyer.Domain.Dtos
{
    /// <summary>A stocked material at or under its threshold, with the recommended quantity and where to get it.</summary>
    public class SilaReplenishmentRowDto
    {
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        /// <summary>Base unit of the material.</summary>
        public string Uom { get; set; } = string.Empty;
        public Guid DestinationLocationId { get; set; }
        public string DestinationName { get; set; } = string.Empty;
        public decimal AvailableQty { get; set; }
        /// <summary>The current month's reorder point (override or base).</summary>
        public decimal? ReorderPoint { get; set; }
        /// <summary>The current month's minimum stock (override or base).</summary>
        public decimal? MinimumStock { get; set; }
        public decimal? ParLevel { get; set; }
        /// <summary>Par level minus available (or threshold minus available without a par level).</summary>
        public decimal RecommendedQty { get; set; }
        /// <summary>Location of the same property with the most transferable stock.</summary>
        public Guid? SourceLocationId { get; set; }
        public string? SourceName { get; set; }
        public decimal? SourceTransferableQty { get; set; }
        /// <summary>CREATE_TRANSFER when a source has stock, else CREATE_PR.</summary>
        public string Action { get; set; } = string.Empty;
        /// <summary>The open purchase request of this location and material, if any.</summary>
        public string? OpenPurchaseRequestNumber { get; set; }

        /// <summary>OUT | LOW (health against the stocking levels), or PR_OPEN when a purchase request is already open.</summary>
        public string? Status { get; set; }
    }
}
