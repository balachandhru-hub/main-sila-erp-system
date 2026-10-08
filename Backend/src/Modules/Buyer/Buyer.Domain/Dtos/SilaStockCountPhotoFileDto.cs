namespace Buyer.Domain.Dtos
{
    /// <summary>The stored photo of a count line, for download.</summary>
    public class SilaStockCountPhotoFileDto
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }
}
