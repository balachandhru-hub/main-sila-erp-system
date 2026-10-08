namespace Buyer.Domain.Dtos
{
    /// <summary>An internal purchase request (PR000001).</summary>
    public class SilaPurchaseRequestDto
    {
        public Guid Id { get; set; }
        public string RequestNumber { get; set; } = string.Empty;
        public Guid LocationId { get; set; }
        public string? LocationName { get; set; }
        public string? LocationType { get; set; }
        public Guid MaterialId { get; set; }
        public string? MaterialCode { get; set; }
        public string? MaterialName { get; set; }
        /// <summary>In the base unit of the material.</summary>
        public decimal Quantity { get; set; }
        public string Uom { get; set; } = string.Empty;
        public string? Reason { get; set; }
        /// <summary>SUBMITTED | ADDED_TO_BUCKET | CANCELLED</summary>
        public string Status { get; set; } = string.Empty;
        /// <summary>LIVE_INVENTORY | REPLENISHMENT | ALERT | MANUAL</summary>
        public string Source { get; set; } = string.Empty;
        public Guid RequestedBy { get; set; }
        public string? RequestedByName { get; set; }
        public DateTime RequestedOn { get; set; }
        public Guid? WeeklyBucketId { get; set; }
        public string? WeeklyBucketCode { get; set; }
        /// <summary>The material is mapped to a catalog product, so it can be added to the weekly bucket.</summary>
        public bool CatalogMapped { get; set; }
    }
}
