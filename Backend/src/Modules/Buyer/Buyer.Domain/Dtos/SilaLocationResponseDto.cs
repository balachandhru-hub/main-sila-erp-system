namespace Buyer.Domain.Dtos
{
    /// <summary>An inventory location (store or outlet) of a property.</summary>
    public class SilaLocationResponseDto
    {
        public Guid Id { get; set; }
        public string LocationCode { get; set; } = string.Empty;
        public string LocationName { get; set; } = string.Empty;
        /// <summary>STORE | OUTLET | VENUE</summary>
        public string LocationType { get; set; } = string.Empty;
        public Guid PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public Guid? OutletId { get; set; }
        public string? OutletName { get; set; }
        /// <summary>BEVERAGE | FOOD | TOBACCO | GENERAL, stores only.</summary>
        public string? StoreCategory { get; set; }
        /// <summary>SAP storage location code.</summary>
        public string? StorageLocationCode { get; set; }
        public bool TransferEnabled { get; set; }
        public bool SalesEnabled { get; set; }
        /// <summary>The VENUE the location sits in, if any.</summary>
        public Guid? ParentLocationId { get; set; }
        public string? ParentLocationName { get; set; }
        public string? GlAccount { get; set; }
        public string? CostCenter { get; set; }
        public string? ProfitCenter { get; set; }
        /// <summary>Users assigned to the location directly.</summary>
        public int UserCount { get; set; }

        public string? Description { get; set; }
        public bool InventoryEnabled { get; set; }
        public bool ConsumptionEnabled { get; set; }

        /// <summary>ACTIVE | INACTIVE (deactivated).</summary>
        public string Status { get; set; } = string.Empty;

        /// <summary>Company code of the property.</summary>
        public string? CompanyCode { get; set; }
    }
}
