namespace Buyer.Domain.Dtos
{
    /// <summary>An open alert in the action center, with its recommended action.</summary>
    public class SilaDashboardActionDto
    {
        public Guid AlertId { get; set; }
        public string AlertType { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty;
        /// <summary>NEW | ACKNOWLEDGED</summary>
        public string Status { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public Guid? LocationId { get; set; }
        public string? LocationName { get; set; }
        public Guid? MaterialId { get; set; }
        public string? MaterialCode { get; set; }
        /// <summary>REQUEST_TRANSFER | REQUEST_PHYSICAL_INVENTORY | INVESTIGATE | REVIEW_TRANSFER</summary>
        public string? RecommendedAction { get; set; }
        public string? ReferenceType { get; set; }
        public Guid? ReferenceId { get; set; }
        public DateTime CreatedOn { get; set; }

        /// <summary>Readable alert type, e.g. "Low stock".</summary>
        public string KindLabel { get; set; } = string.Empty;

        /// <summary>What the problem means now, e.g. "2 BTL on hand, par level 12 BTL".</summary>
        public string? Impact { get; set; }

        /// <summary>What to do, e.g. "Transfer 10 BTL from Main Store".</summary>
        public string? Recommendation { get; set; }

        /// <summary>CREATE_TRANSFER | CREATE_PR | INVESTIGATE</summary>
        public string PrimaryAction { get; set; } = string.Empty;
        public decimal? AvailableQty { get; set; }
        public decimal? ParLevel { get; set; }
        public string? Uom { get; set; }
        public Guid? SourceLocationId { get; set; }
        public string? SourceLocationName { get; set; }
        public decimal? SourceAvailable { get; set; }

        /// <summary>Quantity to transfer or request (base unit), when the action is CREATE_TRANSFER or CREATE_PR.</summary>
        public decimal? RecommendedQty { get; set; }
    }
}
