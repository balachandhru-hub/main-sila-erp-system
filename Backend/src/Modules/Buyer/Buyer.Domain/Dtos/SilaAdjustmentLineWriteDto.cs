namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// One adjusted material. Quantity is positive for opening stock (in) and the waste types (out);
    /// for MANUAL_ADJUSTMENT a positive quantity adds stock and a negative one removes it. UnitCost is per base unit.
    /// </summary>
    public class SilaAdjustmentLineWriteDto
    {
        public Guid MaterialId { get; set; }
        public decimal Quantity { get; set; }
        public string? Uom { get; set; }
        public decimal? UnitCost { get; set; }
    }
}
