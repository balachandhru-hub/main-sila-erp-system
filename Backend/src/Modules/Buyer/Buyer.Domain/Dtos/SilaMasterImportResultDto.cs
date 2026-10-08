namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// The check (preview) or the result (import) of an Excel master data file. Imports are all-or-nothing.
    /// </summary>
    public class SilaMasterImportResultDto
    {
        public string FileName { get; set; } = string.Empty;
        /// <summary>True when the rows were written; false for a preview.</summary>
        public bool Committed { get; set; }
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }
        public int NewRows { get; set; }
        public int UpdateRows { get; set; }
        public int UnchangedRows { get; set; }
        /// <summary>The rows with their action and errors (invalid rows first, at most 200).</summary>
        public List<SilaMasterImportRowDto> Rows { get; set; } = new();
    }
}
