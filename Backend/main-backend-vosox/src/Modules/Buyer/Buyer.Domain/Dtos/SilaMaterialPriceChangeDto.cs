namespace Buyer.Domain.Dtos
{
    /// <summary>A material price change request with its approval trail.</summary>
    public class SilaMaterialPriceChangeDto
    {
        public Guid Id { get; set; }
        public string RequestNumber { get; set; } = string.Empty;
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string BaseUom { get; set; } = string.Empty;
        /// <summary>Approved cost per base unit when the request was made.</summary>
        public decimal? CurrentUnitCost { get; set; }
        /// <summary>Requested price per price UOM.</summary>
        public decimal ProposedUnitCost { get; set; }
        public string? Currency { get; set; }
        public string? PriceUom { get; set; }
        public DateTime? EffectiveFrom { get; set; }
        public string Reason { get; set; } = string.Empty;
        /// <summary>PENDING_APPROVAL | APPROVED | REJECTED.</summary>
        public string Status { get; set; } = string.Empty;
        public Guid RequestedBy { get; set; }
        public string? RequestedByName { get; set; }
        public DateTime RequestedOn { get; set; }
        public DateTime? DecidedOn { get; set; }
        /// <summary>The approver level waiting for a decision, if any.</summary>
        public int? CurrentLevel { get; set; }
        public List<SilaPriceApprovalStepDto> Steps { get; set; } = new();
    }
}
