namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// One row of an Excel master data file.
    /// </summary>
    public class SilaMasterImportRowDto
    {
        public int RowNumber { get; set; }
        public string Key { get; set; } = string.Empty;
        /// <summary>NEW, UPDATE, UNCHANGED or INVALID.</summary>
        public string Action { get; set; } = string.Empty;
        public List<string> Errors { get; set; } = new();
    }
}
