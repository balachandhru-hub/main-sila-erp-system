namespace Buyer.Domain.Dtos
{
    public class SilaPosBatchDto
    {
        public Guid Id { get; set; }
        public string BatchNumber { get; set; } = string.Empty;
        /// <summary>FILE | API</summary>
        public string Source { get; set; } = string.Empty;
        public string? FileName { get; set; }
        public int Rows { get; set; }
        public int Accepted { get; set; }
        public int Duplicates { get; set; }
        public int Invalid { get; set; }
        /// <summary>Accepted lines that are FAILED now.</summary>
        public int Failed { get; set; }
        /// <summary>Accepted lines whose stock was deducted (posted to the ERP or not).</summary>
        public int Processed { get; set; }
        /// <summary>Deducted lines whose ERP posting outcome is unknown (reconcile under ERP postings).</summary>
        public int PostingUnknown { get; set; }
        public Guid UploadedBy { get; set; }
        public string? UploadedByName { get; set; }
        public DateTime DateCreated { get; set; }
        /// <summary>PREVIEW (uploaded, not processed yet) | PROCESSED</summary>
        public string Status { get; set; } = string.Empty;
        public Guid? PosSourceId { get; set; }
        public string? PosSourceName { get; set; }
        public DateTime? BusinessDateFrom { get; set; }
        public DateTime? BusinessDateTo { get; set; }
    }
}
