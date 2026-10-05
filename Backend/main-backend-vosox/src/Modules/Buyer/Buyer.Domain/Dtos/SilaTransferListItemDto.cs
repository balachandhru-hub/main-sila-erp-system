namespace Buyer.Domain.Dtos
{
    public class SilaTransferListItemDto
    {
        public Guid Id { get; set; }
        public string ItoNumber { get; set; } = string.Empty;
        public string Mode { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public Guid FromLocationId { get; set; }
        public string? FromLocationName { get; set; }
        public Guid ToLocationId { get; set; }
        public string? ToLocationName { get; set; }
        public Guid RequestedBy { get; set; }
        public string? RequestedByName { get; set; }
        public DateTime RequestedOn { get; set; }
        public DateTime? RequiredBy { get; set; }
        public int LineCount { get; set; }

        public string? FromLocationType { get; set; }
        public string? ToLocationType { get; set; }

        /// <summary>FROM_TYPE_TO_TO_TYPE, e.g. STORE_TO_OUTLET.</summary>
        public string? TransferRelationship { get; set; }

        /// <summary>Value of the transferred quantity (received, dispatched, approved or requested) at unit cost.</summary>
        public decimal? TotalValue { get; set; }

        /// <summary>Null when the lines carry different currencies.</summary>
        public string? Currency { get; set; }
    }
}
