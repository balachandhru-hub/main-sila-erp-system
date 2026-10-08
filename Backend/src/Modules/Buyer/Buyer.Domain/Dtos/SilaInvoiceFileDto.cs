namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// The stored invoice file, for download.
    /// </summary>
    public class SilaInvoiceFileDto
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }
}
