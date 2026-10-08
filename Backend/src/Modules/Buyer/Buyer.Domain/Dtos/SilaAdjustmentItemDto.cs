namespace Buyer.Domain.Dtos
{
    public class SilaAdjustmentItemDto
    {
        public Guid Id { get; set; }
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string Uom { get; set; } = string.Empty;
        public decimal BaseQuantity { get; set; }
        public decimal? UnitCost { get; set; }
    }
}
