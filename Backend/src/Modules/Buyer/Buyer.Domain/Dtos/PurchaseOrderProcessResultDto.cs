namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A purchase order after it was created or reprocessed, with where each hand-off stands. The order itself exists in this
    /// system whatever the hand-offs say. A leg status is NOT_CONFIGURED (no active API), PENDING (not tried yet, or waiting for
    /// the buyer ERP), SYNCED, FAILED or UNKNOWN (the call broke off; the document may exist there). A screen offers Reprocess
    /// when a leg is PENDING, FAILED or UNKNOWN.
    /// </summary>
    public class PurchaseOrderProcessResultDto
    {
        public Guid Id { get; set; }

        /// <summary>The number of this system.</summary>
        public string PoNumber { get; set; } = string.Empty;

        /// <summary>The number the buyer's ERP returned. Null until it accepted the order.</summary>
        public string? ErpPurchaseOrderId { get; set; }

        /// <summary>The order number the supplier's ERP returned. Null until it accepted the order.</summary>
        public string? SupplierErpSalesOrderNumber { get; set; }

        /// <summary>The number the supplier's ERP receives: the buyer ERP number when there is one, otherwise PoNumber.</summary>
        public string SupplierPurchaseOrderNumber { get; set; } = string.Empty;

        public Guid SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Currency { get; set; }
        public decimal TotalAmount { get; set; }

        public string BuyerErpStatus { get; set; } = string.Empty;
        public string? BuyerErpError { get; set; }
        public string SupplierErpStatus { get; set; } = string.Empty;
        public string? SupplierErpError { get; set; }

        /// <summary>True when Reprocess has something to do.</summary>
        public bool CanReprocess { get; set; }
    }
}
