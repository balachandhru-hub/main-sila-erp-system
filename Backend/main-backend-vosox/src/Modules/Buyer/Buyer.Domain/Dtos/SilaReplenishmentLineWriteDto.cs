namespace Buyer.Domain.Dtos
{
    /// <summary>One replenishment row: move Quantity (base unit) of the material from the source to the destination.</summary>
    public class SilaReplenishmentLineWriteDto
    {
        public Guid MaterialId { get; set; }
        public Guid SourceLocationId { get; set; }
        public Guid DestinationLocationId { get; set; }
        public decimal Quantity { get; set; }
    }
}
