namespace Buyer.Domain.Dtos
{
    /// <summary>The uploaded photo of a count line (multipart file read by the controller).</summary>
    public class SilaStockCountPhotoUploadDto
    {
        public string FileName { get; set; } = string.Empty;
        public string? ContentType { get; set; }
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }
}
