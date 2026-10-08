namespace Buyer.Domain.Dtos
{
    /// <summary>One side of a transfer: SOURCE approves or rejects, DESTINATION receives.</summary>
    public class SilaTransferApprovalDto
    {
        /// <summary>SOURCE | DESTINATION</summary>
        public string Side { get; set; } = string.Empty;

        /// <summary>PENDING | APPROVED | REJECTED | RECEIVED | DISCREPANCY | CANCELLED</summary>
        public string Status { get; set; } = string.Empty;

        /// <summary>Quantities are filled for single-line transfers only (lines of different units cannot be summed).</summary>
        public decimal? AvailableQty { get; set; }
        public decimal? RequestedQty { get; set; }
        public decimal? ApprovedQty { get; set; }
        public decimal? StockAfter { get; set; }
        public string? Comment { get; set; }
        public string? ActorName { get; set; }
        public DateTime? On { get; set; }
    }
}
