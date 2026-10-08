namespace Buyer.Domain.Dtos
{
    /// <summary>A POS system the sales come from, with the number of its outlet and item mappings.</summary>
    public class SilaPosSourceDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        /// <summary>OPERA | MICROS | OTHER</summary>
        public string PosSystem { get; set; } = string.Empty;
        /// <summary>FILE | API</summary>
        public string IntegrationKind { get; set; } = string.Empty;
        public bool IsDefault { get; set; }
        public int OutletMappingCount { get; set; }
        public int ItemMappingCount { get; set; }
    }
}
