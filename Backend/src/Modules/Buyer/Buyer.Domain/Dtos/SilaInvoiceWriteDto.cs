namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// The reviewed invoice fields, its purchase order and its lines.
    /// </summary>
    public class SilaInvoiceWriteDto
    {
        public string? InvoiceNumber { get; set; }
        public Guid? SupplierId { get; set; }

        /// <summary>The Supplier Master row; when not sent it is kept unless the supplier name changes.</summary>
        public Guid? SilaSupplierId { get; set; }
        public string? SupplierName { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public string? Currency { get; set; }
        public decimal? GrossAmount { get; set; }
        /// <summary>MATERIAL | SERVICE | MIXED; null keeps the current type.</summary>
        public string? InvoiceType { get; set; }
        /// <summary>Null keeps the current amount.</summary>
        public decimal? NetAmount { get; set; }
        /// <summary>Null keeps the current amount.</summary>
        public decimal? TaxAmount { get; set; }
        /// <summary>Null keeps the current number; an empty text clears it.</summary>
        public string? SupplierTaxNumber { get; set; }
        public Guid? PurchaseOrderId { get; set; }
        public List<SilaInvoiceItemDto> Items { get; set; } = new();
    }
}
