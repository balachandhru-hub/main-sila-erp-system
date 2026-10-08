namespace Buyer.Domain.Dtos
{
    /// <summary>A request to change the approved unit price of a material; it applies once the approval flow approves it.</summary>
    public class SilaMaterialPriceChangeWriteDto
    {
        /// <summary>New price per price UOM, greater than zero.</summary>
        public decimal UnitPrice { get; set; }
        /// <summary>ISO currency (3 letters). Defaults to the current currency of the material.</summary>
        public string? Currency { get; set; }
        /// <summary>The unit the price is for. Defaults to the base unit; another unit needs a UOM conversion.</summary>
        public string? PriceUom { get; set; }
        public DateTime? EffectiveFrom { get; set; }
        /// <summary>Outlet the price is for; empty changes the default price used by every outlet without its own price.</summary>
        public Guid? OutletLocationId { get; set; }
        public string Reason { get; set; } = string.Empty;
    }
}
