namespace Buyer.Domain.Dtos
{
    /// <summary>Creates or updates an inventory location.</summary>
    public class SilaLocationWriteDto
    {
        /// <summary>A property (BuyerProperty) of the buyer.</summary>
        public Guid PropertyId { get; set; }
        /// <summary>Unique per buyer.</summary>
        public string LocationCode { get; set; } = string.Empty;
        public string LocationName { get; set; } = string.Empty;
        /// <summary>STORE | OUTLET | VENUE</summary>
        public string LocationType { get; set; } = string.Empty;
        /// <summary>Required for OUTLET: an outlet of the same property. One location per outlet.</summary>
        public Guid? OutletId { get; set; }
        /// <summary>Required for STORE: BEVERAGE | FOOD | TOBACCO | GENERAL.</summary>
        public string? StoreCategory { get; set; }
        /// <summary>SAP storage location code.</summary>
        public string? StorageLocationCode { get; set; }
        public bool TransferEnabled { get; set; }
        public bool SalesEnabled { get; set; }
        /// <summary>STORE/OUTLET only: a VENUE location of the same property the location sits in.</summary>
        public Guid? ParentLocationId { get; set; }
        /// <summary>General ledger account of the location.</summary>
        public string? GlAccount { get; set; }
        public string? CostCenter { get; set; }
        public string? ProfitCenter { get; set; }

        /// <summary>Null keeps the saved description; empty clears it.</summary>
        public string? Description { get; set; }

        /// <summary>Null keeps the saved value (enabled for a new location).</summary>
        public bool? InventoryEnabled { get; set; }

        /// <summary>Null keeps the saved value (enabled for a new location).</summary>
        public bool? ConsumptionEnabled { get; set; }
    }
}
