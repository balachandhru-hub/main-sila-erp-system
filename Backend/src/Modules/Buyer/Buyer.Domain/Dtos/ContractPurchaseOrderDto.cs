namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A purchase order created from a contract, with the state of its hand-off to the ERP.
    /// </summary>
    public class ContractPurchaseOrderDto
    {
        public Guid Id { get; set; }
        public string PoNumber { get; set; } = string.Empty;
        public Guid? ContractId { get; set; }
        public string? ContractNumber { get; set; }
        public Guid SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Currency { get; set; }
        public decimal TotalAmount { get; set; }
        public DateTime OrderDate { get; set; }
        public int ItemCount { get; set; }

        /// <summary>Document number the ERP returned. Null until the ERP accepted the order, or when no ERP is configured.</summary>
        public string? ErpPurchaseOrderId { get; set; }

        /// <summary>NOT_CONFIGURED, PENDING, SYNCED, FAILED or UNKNOWN.</summary>
        public string ErpSyncStatus { get; set; } = string.Empty;
        public string? ErpSyncError { get; set; }
    }

    /// <summary>
    /// The purchase order figures of a contract, shown on the contract list and detail.
    /// </summary>
    public class ContractPurchaseOrderSummaryDto
    {
        public int PurchaseOrderCount { get; set; }
        public decimal PurchaseOrderTotal { get; set; }
        public decimal RemainingAmount { get; set; }

        /// <summary>True when the contract is approved, within its dates and has an amount left to order.</summary>
        public bool CanCreatePurchaseOrder { get; set; }

        /// <summary>Why a purchase order cannot be created now. Null when it can.</summary>
        public string? CreateBlockedReason { get; set; }

        /// <summary>The most recently created purchase order of the contract.</summary>
        public ContractPurchaseOrderDto? LatestPurchaseOrder { get; set; }
    }
}
