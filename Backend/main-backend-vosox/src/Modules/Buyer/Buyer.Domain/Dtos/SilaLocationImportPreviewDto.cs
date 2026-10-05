namespace Buyer.Domain.Dtos
{
    /// <summary>What a location import would do. Confirm imports only when InvalidRows and FileErrors are empty.</summary>
    public class SilaLocationImportPreviewDto
    {
        public string FileName { get; set; } = string.Empty;
        public int TotalRows { get; set; }
        public int NewRows { get; set; }
        public int UpdateRows { get; set; }
        public int UnchangedRows { get; set; }
        public int InvalidRows { get; set; }
        /// <summary>Problems of the whole file (missing sheet or columns, too many rows).</summary>
        public List<string> FileErrors { get; set; } = new();
        /// <summary>Invalid rows first, then the others; at most 500.</summary>
        public List<SilaLocationImportRowDto> Rows { get; set; } = new();
        /// <summary>True once the import was applied.</summary>
        public bool Imported { get; set; }
    }
}
