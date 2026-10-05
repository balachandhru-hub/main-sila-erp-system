namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// An uploaded supplier invoice.
    /// </summary>
    public class SilaInvoiceListItemDto
    {
        public Guid Id { get; set; }
        public string? InvoiceNumber { get; set; }
        public Guid? SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public string? Currency { get; set; }
        public decimal? GrossAmount { get; set; }
        public Guid? PurchaseOrderId { get; set; }
        public string? PoNumber { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal? OcrConfidence { get; set; }
        public DateTime UploadedOn { get; set; }
        /// <summary>MATERIAL | SERVICE | MIXED; null when unknown.</summary>
        public string? InvoiceType { get; set; }
        public decimal? NetAmount { get; set; }
        public decimal? TaxAmount { get; set; }
        public string? SupplierTaxNumber { get; set; }
        /// <summary>False for a SERVICE invoice: no goods receipt can be posted for it.</summary>
        public bool GoodsReceiptApplicable { get; set; } = true;
    }
}
