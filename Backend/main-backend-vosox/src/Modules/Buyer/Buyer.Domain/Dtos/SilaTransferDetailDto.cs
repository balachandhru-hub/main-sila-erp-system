namespace Buyer.Domain.Dtos
{
    public class SilaTransferDetailDto
    {
        public Guid Id { get; set; }
        public string ItoNumber { get; set; } = string.Empty;
        public string Mode { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public Guid FromLocationId { get; set; }
        public string? FromLocationName { get; set; }
        public Guid ToLocationId { get; set; }
        public string? ToLocationName { get; set; }
        public string? Reason { get; set; }
        public string? Comment { get; set; }
        public DateTime? RequiredBy { get; set; }
        public Guid RequestedBy { get; set; }
        public string? RequestedByName { get; set; }
        public DateTime RequestedOn { get; set; }
        public DateTime? ApprovedOn { get; set; }
        public DateTime? DispatchedOn { get; set; }
        public DateTime? ReceivedOn { get; set; }
        /// <summary>Quick transfer of stock the requester already took; the source confirms or disputes the handover.</summary>
        public bool AlreadyCollected { get; set; }
        /// <summary>Why the source disputed an already-collected transfer.</summary>
        public string? DisputeReason { get; set; }

        public string? FromLocationType { get; set; }
        public string? ToLocationType { get; set; }

        /// <summary>FROM_TYPE_TO_TO_TYPE, e.g. STORE_TO_OUTLET.</summary>
        public string? TransferRelationship { get; set; }
        public decimal? TotalValue { get; set; }
        public string? Currency { get; set; }

        /// <summary>Approval of the source (approve / reject) and the destination (receive), derived from the events.</summary>
        public List<SilaTransferApprovalDto> Approvals { get; set; } = new();
        public List<SilaTransferItemDto> Items { get; set; } = new();
        public List<SilaTransferEventDto> Events { get; set; } = new();

        /// <summary>What the signed-in user may do now: APPROVE, REJECT, DISPATCH, RECEIVE, CANCEL, CONFIRM_HANDOVER, DISPUTE.</summary>
        public List<string> AllowedActions { get; set; } = new();
    }
}
