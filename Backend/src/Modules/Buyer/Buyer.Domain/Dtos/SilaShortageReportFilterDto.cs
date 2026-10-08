namespace Buyer.Domain.Dtos
{
    /// <summary>Filters of the shortage report. Dates filter the submission date of the count.</summary>
    public class SilaShortageReportFilterDto
    {
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public Guid? LocationId { get; set; }
        /// <summary>Justification category, or NOT_JUSTIFIED for lines without a justification.</summary>
        public string? Category { get; set; }
        public string? EnquiryStatus { get; set; }

        /// <summary>ERP posting status of the line (PENDING, POSTED, FAILED, SKIPPED, UNKNOWN), or NOT_POSTED.</summary>
        public string? SapStatus { get; set; }
    }
}
