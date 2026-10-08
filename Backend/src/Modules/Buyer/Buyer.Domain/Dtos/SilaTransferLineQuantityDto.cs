namespace Buyer.Domain.Dtos
{
    /// <summary>The approved or received quantity (base unit) of one transfer line.</summary>
    public class SilaTransferLineQuantityDto
    {
        public Guid ItemId { get; set; }
        public decimal Quantity { get; set; }
    }
}
