namespace Buyer.Domain.Dtos
{
    /// <summary>The stock of one material at one location.</summary>
    public class SilaLiveInventoryLocationDto
    {
        public Guid LocationId { get; set; }
        public string LocationCode { get; set; } = string.Empty;
        public string LocationName { get; set; } = string.Empty;
        public string LocationType { get; set; } = string.Empty;
        public Guid PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public decimal OnHandQty { get; set; }
        public decimal InTransitQty { get; set; }
        public decimal? MinimumStock { get; set; }
        public bool TransferEnabled { get; set; }
        /// <summary>Stock this location can give to the current location: on hand when transfers are enabled and it is in the same property.</summary>
        public decimal TransferableQty { get; set; }
        /// <summary>The caller works at this location.</summary>
        public bool IsMine { get; set; }
        public DateTime? LastMovementOn { get; set; }

        /// <summary>Plant code of the property.</summary>
        public string? PropertyCode { get; set; }

        /// <summary>Requested or approved on transfers out of this location that have not been dispatched yet.</summary>
        public decimal ReservedQty { get; set; }

        /// <summary>On hand minus reserved.</summary>
        public decimal AvailableQty { get; set; }

        /// <summary>NEGATIVE | OUT | LOW | HEALTHY | EXCESS against the stocking levels; IN_STOCK without levels.</summary>
        public string StockStatus { get; set; } = string.Empty;

        /// <summary>ACTIVE | INACTIVE | NOT_STOCKED</summary>
        public string StockingStatus { get; set; } = string.Empty;

        /// <summary>REGULAR | ON_DEMAND; null when not stocked.</summary>
        public string? StockingType { get; set; }

        /// <summary>Why TransferableQty is what it is, e.g. "Available stock" or "Transfers disabled".</summary>
        public string TransferableBasis { get; set; } = string.Empty;
    }
}
