namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A V1 stock-out / replenishment recommendation: what to buy, how much, from whom when known.
    /// Calculated from stocking levels, current stock and open PO quantity. Not an order.
    /// </summary>
    public class SilaPurchaseRecommendationDto
    {
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public Guid LocationId { get; set; }
        public string LocationName { get; set; } = string.Empty;
        public string? PlantCode { get; set; }
        public string? StorageLocationCode { get; set; }
        /// <summary>Current available stock in the base unit.</summary>
        public decimal CurrentStock { get; set; }
        public decimal? MinimumStock { get; set; }
        public decimal? ReorderPoint { get; set; }
        public decimal? ParLevel { get; set; }
        /// <summary>Open PO quantity converted to the base unit. Closed, cancelled and fully received lines are excluded.</summary>
        public decimal OpenPoQty { get; set; }
        /// <summary>Current stock + open PO qty, in the base unit.</summary>
        public decimal AvailableEffectiveStock { get; set; }
        /// <summary>Recommended purchase quantity in PurchaseUom.</summary>
        public decimal RecommendedQty { get; set; }
        /// <summary>Authoritative purchase / order unit when set; otherwise the material base unit.</summary>
        public string PurchaseUom { get; set; } = string.Empty;
        public string BaseUom { get; set; } = string.Empty;
        public Guid? CatalogId { get; set; }
        public string? CatalogSku { get; set; }
        public Guid? SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public decimal? UnitPrice { get; set; }
        public string? Currency { get; set; }
        public decimal? EstimatedValue { get; set; }
        /// <summary>STOCK_OUT | BELOW_MINIMUM | BELOW_PAR</summary>
        public string Reason { get; set; } = string.Empty;
        /// <summary>Missing catalog, supplier, price or UOM conversion. Null when complete enough to add to a PO path.</summary>
        public string? ConfigurationIssue { get; set; }
        /// <summary>Open internal purchase request of this location and material, if any.</summary>
        public string? OpenPurchaseRequestNumber { get; set; }
        public Guid? OpenPurchaseRequestId { get; set; }
        /// <summary>True when a submitted PR already covers this material and location.</summary>
        public bool DuplicateBlocked { get; set; }
        public bool CanAddToPo { get; set; }
    }

    public class SilaPurchaseRecommendationListDto
    {
        public int StockOut { get; set; }
        public int BelowMinimum { get; set; }
        public int BelowPar { get; set; }
        public int RecommendedPurchase { get; set; }
        public decimal? EstimatedValue { get; set; }
        public string? EstimatedCurrency { get; set; }
        public List<SilaPurchaseRecommendationDto> Items { get; set; } = new();
        public List<SilaPurchaseRecommendationSkipDto> Skipped { get; set; } = new();
    }

    /// <summary>A stocking row that cannot be recommended because required master data is missing.</summary>
    public class SilaPurchaseRecommendationSkipDto
    {
        public Guid? MaterialId { get; set; }
        public string? MaterialCode { get; set; }
        public Guid? LocationId { get; set; }
        public string? LocationName { get; set; }
        /// <summary>MISSING_THRESHOLD | MISSING_UOM_CONVERSION</summary>
        public string Reason { get; set; } = string.Empty;
    }

    public class SilaPurchaseRecommendationAcceptWriteDto
    {
        public List<SilaPurchaseRecommendationAcceptLineDto> Lines { get; set; } = new();
        /// <summary>When true, each created PR is added to the current weekly bucket through the existing add-to-bucket path.</summary>
        public bool AddToBucket { get; set; }
    }

    public class SilaPurchaseRecommendationAcceptLineDto
    {
        public Guid MaterialId { get; set; }
        public Guid LocationId { get; set; }
        /// <summary>Buyer-reviewed quantity in the recommendation purchase UOM.</summary>
        public decimal Quantity { get; set; }
        public string? Uom { get; set; }
    }

    public class SilaPurchaseRecommendationAcceptResultDto
    {
        public List<SilaPurchaseRequestDto> PurchaseRequests { get; set; } = new();
        public List<SilaPurchaseRecommendationAcceptLineResultDto> Lines { get; set; } = new();
    }

    public class SilaPurchaseRecommendationAcceptLineResultDto
    {
        public Guid MaterialId { get; set; }
        public Guid LocationId { get; set; }
        public Guid? PurchaseRequestId { get; set; }
        public string? RequestNumber { get; set; }
        public Guid? WeeklyBucketId { get; set; }
        public string? BucketCode { get; set; }
        public string? Error { get; set; }
    }
}
