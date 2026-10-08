namespace Buyer.Domain.Dtos
{
    /// <summary>A generated Excel file.</summary>
    public class SilaRecipeFileDto
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }
}
