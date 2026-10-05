namespace Buyer.Domain.Dtos
{
    public class SilaPosSourceWriteDto
    {
        public string Name { get; set; } = string.Empty;
        /// <summary>OPERA | MICROS | OTHER</summary>
        public string PosSystem { get; set; } = string.Empty;
        /// <summary>FILE | API</summary>
        public string IntegrationKind { get; set; } = string.Empty;
        /// <summary>The default source is used for API pulls and for uploads without a source.</summary>
        public bool IsDefault { get; set; }
    }
}
