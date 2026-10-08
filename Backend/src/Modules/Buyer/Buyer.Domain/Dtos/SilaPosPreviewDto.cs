namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Validation of an uploaded sales file. The valid, new lines are stored in a PREVIEW batch as RECEIVED and are
    /// processed by "Process" (pos/batches/{id}/process); lines that are not ready fail there with their reason.
    /// </summary>
    public class SilaPosPreviewDto
    {
        public Guid BatchId { get; set; }
        public string BatchNumber { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public Guid? PosSourceId { get; set; }
        public string? PosSourceName { get; set; }
        public int TotalRows { get; set; }
        /// <summary>Lines stored in the batch: every line that is neither invalid nor a duplicate.</summary>
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }
        public int DuplicateRows { get; set; }
        public int UnmappedPosCodes { get; set; }
        public int InvalidOutlets { get; set; }
        public int InvalidUom { get; set; }
        public int RecipeNotReady { get; set; }
        public int ReadyToProcess { get; set; }
        /// <summary>Lines with a problem first, then ready lines, at most 500 in all, in file order.</summary>
        public List<SilaPosPreviewRowDto> Rows { get; set; } = new();
        public bool RowsTruncated { get; set; }
    }
}
