namespace Buyer.Domain.Dtos
{
    /// <summary>A generated file (Excel template) returned to the browser.</summary>
    public class SilaPosFileDto
    {
        public byte[] Content { get; set; } = Array.Empty<byte>();
        public string ContentType { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
    }
}
