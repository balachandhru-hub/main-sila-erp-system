namespace Buyer.Domain.Dtos
{
    /// <summary>Raises an internal purchase request for a material at a location.</summary>
    public class SilaPurchaseRequestWriteDto
    {
        public Guid LocationId { get; set; }
        public Guid MaterialId { get; set; }
        /// <summary>Greater than zero, in Uom (default: the base unit of the material).</summary>
        public decimal Quantity { get; set; }
        public string? Uom { get; set; }
        public string? Reason { get; set; }
        /// <summary>LIVE_INVENTORY | REPLENISHMENT | ALERT | MANUAL (default MANUAL).</summary>
        public string? Source { get; set; }
    }
}
