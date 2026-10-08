namespace Buyer.Domain.Dtos
{
    /// <summary>A generated Excel workbook, for download.</summary>
    public class SilaExcelFileDto
    {
        public string FileName { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }
}
