namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Preview (or result) of a material Excel import. The import is all-or-nothing: it is applied only when no row is invalid.
    /// </summary>
    public class SilaMaterialImportResultDto
    {
        public string FileName { get; set; } = string.Empty;
        public bool Applied { get; set; }
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }
        public int ChangedRows { get; set; }
        public int UnchangedRows { get; set; }
        /// <summary>Price change requests the import creates (they go through approval).</summary>
        public int PriceChanges { get; set; }
        /// <summary>UOM conversions added or updated.</summary>
        public int Conversions { get; set; }
        /// <summary>Messages that concern the whole file, e.g. a missing approval flow.</summary>
        public List<string> FileErrors { get; set; } = new();
        /// <summary>Invalid rows first, then the others; at most 500.</summary>
        public List<SilaMaterialImportRowDto> Rows { get; set; } = new();
    }
}
