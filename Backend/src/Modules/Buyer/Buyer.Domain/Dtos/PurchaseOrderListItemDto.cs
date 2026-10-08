namespace Buyer.Domain.Dtos
{
    public class PurchaseOrderListItemDto
    {
        public Guid Id { get; set; }
        public string PoNumber { get; set; } = string.Empty;

        /// <summary>
        /// The number this system gave the order, when PoNumber shows the buyer ERP's number instead (the supplier's list). Null
        /// where PoNumber is the number of this system.
        /// </summary>
        public string? LocalPoNumber { get; set; }
        public Guid SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public string? BuyerName { get; set; }
        public string? BucketCode { get; set; }
        public string? PlantCode { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Currency { get; set; }
        public decimal TotalAmount { get; set; }
        public DateTime OrderDate { get; set; }
        public int ItemCount { get; set; }
        public Guid? ContractId { get; set; }
        public string? ContractNumber { get; set; }
        public string? ErpPurchaseOrderId { get; set; }

        /// <summary>CONTRACT, MANUAL, WEEKLY_BUCKET or the source of an order read from an ERP.</summary>
        public string? SourceType { get; set; }

        /// <summary>The order number the supplier's ERP returned. Null until it accepted the order.</summary>
        public string? SupplierErpSalesOrderNumber { get; set; }

        /// <summary>
        /// Where the hand-off to the buyer's ERP stands: NOT_CONFIGURED, PENDING, SYNCED, FAILED or UNKNOWN. Empty for orders that
        /// are not created here (a contract or a user creates them).
        /// </summary>
        public string? ErpSyncStatus { get; set; }
        public string? ErpSyncError { get; set; }

        /// <summary>The same for the hand-off to the supplier's ERP.</summary>
        public string? SupplierErpSyncStatus { get; set; }
        public string? SupplierErpSyncError { get; set; }

        /// <summary>True when Reprocess has a hand-off to send (PENDING, FAILED or UNKNOWN).</summary>
        public bool CanReprocess { get; set; }
    }
}
