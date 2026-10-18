namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A purchase order with the ordered, received and open quantity of each line.
    /// </summary>
    public class SilaReceivingPoDetailDto
    {
        public Guid Id { get; set; }
        public string PoNumber { get; set; } = string.Empty;
        public Guid SupplierId { get; set; }
        public string? SupplierName { get; set; }
        /// <summary>ERP supplier number. A system id is not used as the supplier.</summary>
        public string? SupplierCode { get; set; }
        public DateTime OrderDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? CompanyCode { get; set; }
        public string? PlantCode { get; set; }
        public string? Currency { get; set; }
        public decimal TotalAmount { get; set; }
        /// <summary>Company code (entity) of the purchase order.</summary>
        public string? EntityCode { get; set; }
        public DateTime? DeliveryDate { get; set; }
        public decimal TotalOrderedQuantity { get; set; }
        /// <summary>ERP or system the purchase order came from.</summary>
        public string? SourceSystem { get; set; }
        public string? SourceType { get; set; }
        public string? ErpPurchaseOrderId { get; set; }
        public string? SupplierErpSalesOrderNumber { get; set; }
        public string? BucketCode { get; set; }
        public decimal TotalReceivedQuantity { get; set; }
        public decimal TotalOpenQuantity { get; set; }
        public int LineCount { get; set; }
        public int OpenLineCount { get; set; }
        public List<SilaReceivingPoLineDto> Lines { get; set; } = new();
        /// <summary>PO → GRN → Invoice → Attachment → Payment → SOA.</summary>
        public SilaDocumentTrackDto? DocumentTrack { get; set; }
    }
}
