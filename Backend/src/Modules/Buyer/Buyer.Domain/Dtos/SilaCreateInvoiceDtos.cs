namespace Buyer.Domain.Dtos
{
    public class SilaCreateInvoiceRequestDto
    {
        /// <summary>PO or NON_PO.</summary>
        public string CreationType { get; set; } = "PO";
        public Guid? PropertyId { get; set; }
        public string? CompanyCode { get; set; }
        public Guid? SilaSupplierId { get; set; }
        public Guid? SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public string? InvoiceNumber { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public DateTime? PostingDate { get; set; }
        public DateTime? TaxDeterminationDate { get; set; }
        public string? Currency { get; set; }
        public decimal? GrossAmount { get; set; }
        public decimal? NetAmount { get; set; }
        public decimal? TaxAmount { get; set; }
        public string? Reference { get; set; }
        public Guid? PurchaseOrderId { get; set; }
        public List<Guid> GoodsReceiptIds { get; set; } = new();
        public List<SilaCreateInvoiceLineDto> Lines { get; set; } = new();
        /// <summary>One PDF, JPEG or PNG. Required on Create Invoice.</summary>
        public string? FileName { get; set; }
        public string? ContentType { get; set; }
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }

    public class SilaCreateInvoiceLineDto
    {
        public int LineNumber { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal? Quantity { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal? Amount { get; set; }
        public string? Uom { get; set; }
        public string? TaxCode { get; set; }
        public decimal? TaxRate { get; set; }
        public Guid? PurchaseOrderItemId { get; set; }
        public Guid? GoodsReceiptItemId { get; set; }
        public string? GlAccount { get; set; }
        public string? CostCenter { get; set; }
        public string? ProfitCenter { get; set; }
        public string? InternalOrder { get; set; }
        public string? WbsElement { get; set; }
        public string? BusinessArea { get; set; }
        public string? AssignmentReference { get; set; }
        public string? DebitCreditCode { get; set; }
        public string? LineText { get; set; }
    }

    public class SilaEligiblePurchaseOrderDto
    {
        public Guid Id { get; set; }
        public string PoNumber { get; set; } = string.Empty;
        public DateTime? OrderDate { get; set; }
        public DateTime? CreatedOn { get; set; }
        public string? CompanyCode { get; set; }
        public string? Currency { get; set; }
        public decimal? TotalAmount { get; set; }
        public decimal? ReceivedQuantity { get; set; }
        public decimal? OrderedQuantity { get; set; }
        public int GrnCount { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? SupplierName { get; set; }
        public string? SupplierCode { get; set; }
        public Guid? SupplierId { get; set; }
        public Guid? SilaSupplierId { get; set; }
    }

    public class SilaEligibleGoodsReceiptDto
    {
        public Guid Id { get; set; }
        public string GrnNumber { get; set; } = string.Empty;
        public string? ErpReference { get; set; }
        public DateTime ReceivedOn { get; set; }
        public string PoNumber { get; set; } = string.Empty;
        public string? SupplierName { get; set; }
        public decimal ReceivedQuantity { get; set; }
        public decimal InvoicedQuantity { get; set; }
        public decimal RemainingQuantity { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? InvoiceStatus { get; set; }
        public List<SilaEligibleGoodsReceiptLineDto> Lines { get; set; } = new();
    }

    public class SilaEligibleGoodsReceiptLineDto
    {
        public Guid Id { get; set; }
        public Guid PurchaseOrderItemId { get; set; }
        public int? PurchaseOrderItemNumber { get; set; }
        public string Description { get; set; } = string.Empty;
        public string? MaterialCode { get; set; }
        public string? Uom { get; set; }
        public decimal ReceivedQuantity { get; set; }
        public decimal ReversedQuantity { get; set; }
        public decimal NetReceivedQuantity { get; set; }
        public decimal InvoicedQuantity { get; set; }
        public decimal RemainingQuantity { get; set; }
        public decimal? UnitPrice { get; set; }
        public string? TaxCode { get; set; }
    }

    public class SilaCreateInvoiceMastersDto
    {
        public List<SilaCreateInvoicePropertyDto> Properties { get; set; } = new();
        public List<SilaCreateInvoiceCompanyDto> CompanyCodes { get; set; } = new();
        public List<string> GlAccounts { get; set; } = new();
        public List<string> CostCenters { get; set; } = new();
        public List<string> ProfitCenters { get; set; } = new();
        public List<string> TaxCodes { get; set; } = new();
    }

    public class SilaCreateInvoicePropertyDto
    {
        public Guid Id { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public string CompanyCode { get; set; } = string.Empty;
        public string? PlantCode { get; set; }
    }

    public class SilaCreateInvoiceCompanyDto
    {
        public Guid Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string? Name { get; set; }
    }
}
