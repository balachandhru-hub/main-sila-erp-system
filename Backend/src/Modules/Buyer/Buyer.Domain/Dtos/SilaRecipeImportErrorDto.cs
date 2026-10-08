namespace Buyer.Domain.Dtos
{
    /// <summary>One problem of an Excel import row.</summary>
    public class SilaRecipeImportErrorDto
    {
        public string Sheet { get; set; } = string.Empty;
        /// <summary>Row of the sheet (header = 1).</summary>
        public int Row { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
