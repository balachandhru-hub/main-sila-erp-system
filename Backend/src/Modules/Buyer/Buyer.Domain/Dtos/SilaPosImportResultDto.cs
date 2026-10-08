namespace Buyer.Domain.Dtos
{
    /// <summary>Outcome of a sales file upload or a POS API pull.</summary>
    public class SilaPosImportResultDto
    {
        public Guid BatchId { get; set; }
        public string BatchNumber { get; set; } = string.Empty;
        public int Rows { get; set; }
        public int Accepted { get; set; }
        public int Duplicates { get; set; }
        public int Invalid { get; set; }
        /// <summary>Accepted lines whose stock was deducted and whose ERP posting was queued.</summary>
        public int Processed { get; set; }
        /// <summary>Accepted lines that failed matching or deduction; the tracker shows why.</summary>
        public int Failed { get; set; }
        /// <summary>Lines of the batch that were already deducted or posted before this run (not processed again).</summary>
        public int AlreadyPosted { get; set; }
        /// <summary>Lines of the batch whose ERP posting outcome is unknown (reconcile under ERP postings).</summary>
        public int PostingUnknown { get; set; }
        public List<SilaPosRowErrorDto> Errors { get; set; } = new();
    }
}
