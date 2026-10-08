namespace Buyer.Domain.Dtos
{
    /// <summary>The approved unit cost (per base unit) of a material at one outlet; it replaces the default price there.</summary>
    public class SilaMaterialOutletPriceDto
    {
        public Guid OutletLocationId { get; set; }
        public decimal UnitCost { get; set; }
        public string? Currency { get; set; }
    }
}
