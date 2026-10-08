namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// One reading of an invoice (upload, manual or re-read) and what it found.
    /// </summary>
    public class SilaInvoiceExtractionDto
    {
        public Guid Id { get; set; }
        public int Attempt { get; set; }
        /// <summary>UPLOAD, MANUAL or REREAD.</summary>
        public string Trigger { get; set; } = string.Empty;
        /// <summary>PDF_TEXT, OCR or EXTERNAL.</summary>
        public string Method { get; set; } = string.Empty;
        /// <summary>COMPLETED or FAILED.</summary>
        public string Status { get; set; } = string.Empty;
        public decimal? Confidence { get; set; }
        public string? Message { get; set; }
        public SilaInvoiceOcrFieldsDto? Fields { get; set; }
        public int LineCount { get; set; }
        public Guid? CreatedBy { get; set; }
        public DateTime CreatedOn { get; set; }
        /// <summary>BUILT_IN | EXTERNAL | CACHED (result reused from an identical file).</summary>
        public string? Provider { get; set; }
        /// <summary>Time the reader took, in milliseconds.</summary>
        public int? DurationMs { get; set; }
        /// <summary>SHA-256 of the file read.</summary>
        public string? ContentHash { get; set; }
    }
}
