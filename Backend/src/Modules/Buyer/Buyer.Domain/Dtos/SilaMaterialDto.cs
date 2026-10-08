namespace Buyer.Domain.Dtos
{
    /// <summary>An Item Master material with its inventory fields, approved price, price status and UOM conversions.</summary>
    public class SilaMaterialDto
    {
        public Guid Id { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? MaterialGroup { get; set; }
        public string BaseUom { get; set; } = string.Empty;
        /// <summary>Approved cost per base unit.</summary>
        public decimal? UnitCost { get; set; }
        public string? Currency { get; set; }
        public string? Barcode { get; set; }
        public bool IsInventoryItem { get; set; }
        /// <summary>STOCK | NON_STOCK | SERVICE.</summary>
        public string? InventoryType { get; set; }
        public bool BatchManaged { get; set; }
        public bool ExpiryManaged { get; set; }
        public int? ShelfLifeDays { get; set; }
        public bool SerialManaged { get; set; }
        public decimal? StandardPrice { get; set; }
        public decimal? MovingAveragePrice { get; set; }
        /// <summary>APPROVED | MISSING | PENDING_APPROVAL.</summary>
        public string PriceStatus { get; set; } = string.Empty;
        /// <summary>The price change waiting for approval, if any.</summary>
        public Guid? PendingPriceChangeId { get; set; }
        public decimal? ProposedUnitCost { get; set; }
        public string? ProposedPriceUom { get; set; }
        public List<SilaUomConversionDto> Conversions { get; set; } = new();

        /// <summary>ERP (created by an ERP pull) | ITEM_MASTER.</summary>
        public string Source { get; set; } = string.Empty;
        public DateTime UpdatedAt { get; set; }

        /// <summary>Price unit of the last approved price change (the base unit when none).</summary>
        public string? ApprovedPriceUom { get; set; }
        public DateTime? PriceApprovedOn { get; set; }
        public string? CompanyCode { get; set; }

        /// <summary>S (standard price set) | V (moving average price set) | null.</summary>
        public string? PriceControl { get; set; }
        public string? ValuationClass { get; set; }

        /// <summary>Item Master product type.</summary>
        public string? MaterialType { get; set; }

        /// <summary>Item Master material group, shown as the category.</summary>
        public string? Category { get; set; }
        public string? AlternateUom { get; set; }
        public string? OrderUom { get; set; }
    }
}
