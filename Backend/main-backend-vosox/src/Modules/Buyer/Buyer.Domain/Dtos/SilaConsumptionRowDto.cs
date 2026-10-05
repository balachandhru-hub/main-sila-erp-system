namespace Buyer.Domain.Dtos
{
    /// <summary>Recipe consumption of one material over the last 7 days.</summary>
    public class SilaConsumptionRowDto
    {
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string Uom { get; set; } = string.Empty;
        public decimal Value { get; set; }

        /// <summary>The location that consumed it, or "N locations".</summary>
        public string? LocationName { get; set; }
    }
}
