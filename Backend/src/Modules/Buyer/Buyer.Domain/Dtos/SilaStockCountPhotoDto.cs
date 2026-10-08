namespace Buyer.Domain.Dtos
{
    /// <summary>A photo taken of a count line, as evidence of the counted quantity.</summary>
    public class SilaStockCountPhotoDto
    {
        public Guid Id { get; set; }
        public Guid StockCountItemId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public DateTime DateCreated { get; set; }
    }
}
