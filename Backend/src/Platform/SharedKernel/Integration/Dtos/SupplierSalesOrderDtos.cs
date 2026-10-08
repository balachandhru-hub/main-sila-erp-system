namespace SharedKernel.Integration.Dtos
{
    /// <summary>
    /// One line of a purchase order handed to the supplier's ERP as a sales order.
    /// </summary>
    public class SupplierSalesOrderLineDto
    {
        public int LineNumber { get; set; }
        public string? MaterialCode { get; set; }
        public string? Sku { get; set; }
        public string? Description { get; set; }
        public decimal Quantity { get; set; }
        public string? UnitOfMeasure { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal LineAmount { get; set; }
        public string? Currency { get; set; }
        public string? StorageLocation { get; set; }
    }

    /// <summary>
    /// A purchase order of a buyer, sent by the Buyer service to the Supplier service, which hands it to the supplier's own
    /// ERP through the supplier's active sales order API (POST_SALES_ORDER).
    /// </summary>
    public class SupplierSalesOrderRequestDto
    {
        /// <summary>The supplier (supplier profile id) the order is for.</summary>
        public Guid SupplierId { get; set; }

        /// <summary>The number the supplier sees: the buyer ERP's purchase order number when it has one, otherwise the number of this system.</summary>
        public string PurchaseOrderNumber { get; set; } = string.Empty;

        /// <summary>The number given by this system.</summary>
        public string? LocalPurchaseOrderNumber { get; set; }

        public Guid BuyerOrganizationId { get; set; }
        public string? BuyerName { get; set; }
        public string? CompanyCode { get; set; }
        public string? PlantCode { get; set; }
        public string? Currency { get; set; }
        public DateTime OrderDate { get; set; }
        public DateTime? DeliveryDate { get; set; }
        public decimal TotalAmount { get; set; }

        /// <summary>The same key for every attempt of the same order, so the supplier's ERP can recognise a repeat.</summary>
        public string IdempotencyKey { get; set; } = string.Empty;
        public string CorrelationId { get; set; } = string.Empty;
        public List<SupplierSalesOrderLineDto> Lines { get; set; } = new();
    }

    /// <summary>
    /// What came of handing the order to the supplier's ERP. A failed call is a result, not an error.
    /// </summary>
    public class SupplierSalesOrderResultDto
    {
        /// <summary>False when the supplier has no active sales order API: nothing was sent.</summary>
        public bool Configured { get; set; }

        /// <summary>Whether the ERP answered at all.</summary>
        public bool Answered { get; set; }

        public bool Succeeded { get; set; }
        public int StatusCode { get; set; }

        /// <summary>The sales order number the supplier's ERP returned.</summary>
        public string? DocumentNumber { get; set; }
        public string? ErrorCode { get; set; }
        public string? ErrorMessage { get; set; }

        /// <summary>The call broke off or the ERP failed after receiving it: the order may exist there.</summary>
        public bool OutcomeUnknown { get; set; }
        public string? ResponseBody { get; set; }
        public long DurationMs { get; set; }
        public Guid? ConfigurationId { get; set; }
        public string? SystemName { get; set; }
    }
}
