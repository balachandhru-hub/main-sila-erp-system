namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A generated file (Excel template or export).
    /// </summary>
    public class SilaReceivingFileDto
    {
        public byte[] Content { get; set; } = Array.Empty<byte>();
        public string ContentType { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
    }
}
