namespace Buyer.Domain.Dtos
{
    /// <summary>One ingredient consumption (RECIPE_CONSUMPTION ledger line) of a POS sale.</summary>
    public class SilaPosConsumptionLineDto
    {
        public Guid Id { get; set; }
        public string TransactionNumber { get; set; } = string.Empty;
        public Guid MaterialId { get; set; }
        public string? MaterialCode { get; set; }
        public string? MaterialDescription { get; set; }
        public decimal Quantity { get; set; }
        public string Uom { get; set; } = string.Empty;
        public decimal? UnitCost { get; set; }
        public decimal? Value { get; set; }
        public DateTime DateCreated { get; set; }
    }
}
