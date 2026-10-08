namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// An invoice file sent by the user (PDF, JPEG or PNG).
    /// </summary>
    public class SilaInvoiceUploadDto
    {
        public string FileName { get; set; } = string.Empty;
        public string? ContentType { get; set; }
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }
}
