namespace Buyer.Domain.Dtos
{
    public class SilaCreditMemoReferenceInvoiceDto
    {
        public Guid Id { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? ErpInvoiceId { get; set; }
        public string? FiscalYear { get; set; }
        public string? SupplierName { get; set; }
        public string? PoNumber { get; set; }
        public string? CompanyCode { get; set; }
        public string? Currency { get; set; }
        public decimal? OriginalGrossAmount { get; set; }
        public DateTime? PostingDate { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? HeaderText { get; set; }
    }

    public class SilaCreditMemoEligibleLineDto
    {
        public Guid InvoiceLineId { get; set; }
        public int LineNumber { get; set; }
        public string? PoNumber { get; set; }
        public string? PoItem { get; set; }
        public string? Material { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal OriginalQuantity { get; set; }
        public decimal OriginalAmount { get; set; }
        public decimal PreviouslyCreditedQuantity { get; set; }
        public decimal PreviouslyCreditedAmount { get; set; }
        public decimal RemainingQuantity { get; set; }
        public decimal RemainingAmount { get; set; }
        public string? Uom { get; set; }
        public string? TaxCode { get; set; }
    }

    public class SilaCreditMemoLineWriteDto
    {
        public Guid InvoiceLineId { get; set; }
        public decimal? Quantity { get; set; }
        public decimal? Amount { get; set; }
        public string? Reason { get; set; }
    }

    public class SilaCreditMemoWriteDto
    {
        public Guid? ReferenceInvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? ErpInvoiceId { get; set; }
        public string? CreditMemoReference { get; set; }
        public DateTime? DocumentDate { get; set; }
        public DateTime? PostingDate { get; set; }
        public DateTime? TaxCalculationDate { get; set; }
        public string? Reason { get; set; }
        public string? HeaderText { get; set; }
        public List<SilaCreditMemoLineWriteDto> Lines { get; set; } = new();
    }

    public class SilaCreditMemoLineDto
    {
        public Guid Id { get; set; }
        public Guid? ReferenceInvoiceLineId { get; set; }
        public int LineNumber { get; set; }
        public string? PoNumber { get; set; }
        public string? PoItem { get; set; }
        public string? Material { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal? Quantity { get; set; }
        public string? Uom { get; set; }
        public decimal? Amount { get; set; }
        public string? TaxCode { get; set; }
        public string? Reason { get; set; }
        public decimal OriginalQuantity { get; set; }
        public decimal OriginalAmount { get; set; }
        public decimal PreviouslyCreditedQuantity { get; set; }
        public decimal PreviouslyCreditedAmount { get; set; }
        public decimal RemainingQuantity { get; set; }
        public decimal RemainingAmount { get; set; }
    }

    public class SilaCreditMemoListItemDto
    {
        public Guid Id { get; set; }
        public string? CreditMemoNumber { get; set; }
        public Guid ReferenceInvoiceId { get; set; }
        public string? ReferenceSupplierInvoiceNumber { get; set; }
        public string? ReferenceErpInvoiceId { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal? GrossAmount { get; set; }
        public string? Currency { get; set; }
        public DateTime CreatedOn { get; set; }
        public string? ErpReference { get; set; }
        public string? FiscalYear { get; set; }
        public string? SupplierName { get; set; }
        public string? PoNumber { get; set; }
    }

    public class SilaCreditMemoDetailDto
    {
        public Guid Id { get; set; }
        public Guid BuyerId { get; set; }
        public string? CreditMemoNumber { get; set; }
        public string? CreditMemoReference { get; set; }
        public Guid ReferenceInvoiceId { get; set; }
        public string? ReferenceSupplierInvoiceNumber { get; set; }
        public string? ReferenceErpInvoiceId { get; set; }
        public string? ReferenceFiscalYear { get; set; }
        public Guid? SupplierId { get; set; }
        public Guid? SilaSupplierId { get; set; }
        public string? SupplierName { get; set; }
        public Guid? PurchaseOrderId { get; set; }
        public string? PoNumber { get; set; }
        public string? CompanyCode { get; set; }
        public string? Currency { get; set; }
        public DateTime? DocumentDate { get; set; }
        public DateTime? PostingDate { get; set; }
        public DateTime? TaxCalculationDate { get; set; }
        public string? Reason { get; set; }
        public string? HeaderText { get; set; }
        public decimal? GrossAmount { get; set; }
        public string Status { get; set; } = string.Empty;
        public Guid? ErpPostingId { get; set; }
        public string? ErpStatus { get; set; }
        public string? ErpReference { get; set; }
        public string? FiscalYear { get; set; }
        public string? ErpMessage { get; set; }
        public string? IntegrationName { get; set; }
        public DateTime? PostedOn { get; set; }
        public bool CanSubmit { get; set; }
        public bool CanRetry { get; set; }
        public bool ReferenceLocked { get; set; } = true;
        public List<SilaCreditMemoLineDto> Lines { get; set; } = new();
        public SilaCreditMemoReferenceInvoiceDto ReferenceInvoice { get; set; } = new();
        public SilaDocumentTrackDto? DocumentTrack { get; set; }
        public List<SilaDocumentTrackEventDto> History { get; set; } = new();
    }
}
