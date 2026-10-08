namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// The details the buyer ERP needs for a purchase order and the contract does not hold. All optional: they are
    /// only required (see <see cref="ContractPurchaseOrderDraftDto.RequiredFields"/>) when the buyer has an active
    /// purchase order API.
    /// </summary>
    public class CreateContractPurchaseOrderRequestDto
    {
        /// <summary>SAP document type, for example NB. Defaults to NB.</summary>
        public string? PurchaseOrderType { get; set; }
        public string? PurchasingOrganization { get; set; }
        public string? PurchasingGroup { get; set; }
        public string? CompanyCode { get; set; }

        /// <summary>The supplier's vendor number in the ERP.</summary>
        public string? SupplierCode { get; set; }

        /// <summary>Defaults to today.</summary>
        public DateTime? PurchaseOrderDate { get; set; }
        public string? Plant { get; set; }
        public string? StorageLocation { get; set; }

        /// <summary>SAP account assignment category, for example U or K. Defaults to U.</summary>
        public string? AccountAssignmentCategory { get; set; }
        public string? GlAccount { get; set; }
    }

    /// <summary>
    /// What the contract screen needs before it creates a purchase order: whether an ERP will be called, which ERP
    /// details must then be entered, and the values already known.
    /// </summary>
    public class ContractPurchaseOrderDraftDto
    {
        public bool ErpConfigured { get; set; }

        /// <summary>Names (as in <see cref="CreateContractPurchaseOrderRequestDto"/>) that must be filled when the ERP is configured.</summary>
        public List<string> RequiredFields { get; set; } = new();

        public CreateContractPurchaseOrderRequestDto Values { get; set; } = new();
    }

    /// <summary>
    /// One line of a contract: what was awarded to the supplier, priced from the supplier's quotation.
    /// </summary>
    public class ContractItemDto
    {
        public int LineNumber { get; set; }
        public string? MaterialCode { get; set; }
        public string? MaterialGroup { get; set; }
        public string? CostCenter { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string? UnitOfMeasure { get; set; }

        /// <summary>Null when the award has no per-item price (a lot-wise award) or the quotation could not be read.</summary>
        public decimal? UnitPrice { get; set; }
        public decimal? LineAmount { get; set; }
    }
}
