namespace Buyer.Domain.Dtos
{
    /// <summary>Stock value held at one location.</summary>
    public class SilaLocationValueDto
    {
        public Guid LocationId { get; set; }
        public string LocationCode { get; set; } = string.Empty;
        public string LocationName { get; set; } = string.Empty;
        public string LocationType { get; set; } = string.Empty;
        public decimal Value { get; set; }
        /// <summary>Share of the total stock value in scope, 0-100.</summary>
        public decimal SharePercent { get; set; }

        /// <summary>True for the "Other locations" row that sums the locations beyond the top list.</summary>
        public bool Aggregated { get; set; }
    }
}
