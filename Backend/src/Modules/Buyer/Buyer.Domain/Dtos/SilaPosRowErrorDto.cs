namespace Buyer.Domain.Dtos
{
    public class SilaPosRowErrorDto
    {
        /// <summary>Row of the file (header = 1) or position of the API record (first = 1).</summary>
        public int Row { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
