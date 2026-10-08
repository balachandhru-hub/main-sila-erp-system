namespace Buyer.Domain.Dtos
{
    public class SilaStockCountBarcodeDto
    {
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string BaseUom { get; set; } = string.Empty;
        /// <summary>The line of the count for the material; null when the material is not on the count sheet yet.</summary>
        public SilaStockCountItemDto? Item { get; set; }
    }
}
