namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Header fields the OCR read from an invoice; every value may be missing.
    /// </summary>
    public class SilaInvoiceOcrFieldsDto
    {
        public string? InvoiceNumber { get; set; }
        public string? InvoiceDate { get; set; }
        public string? Currency { get; set; }
        public decimal? GrossAmount { get; set; }
        public string? SupplierName { get; set; }
        public string? PoNumber { get; set; }
        public string? SupplierTaxNumber { get; set; }
        public decimal? NetAmount { get; set; }
        public decimal? TaxAmount { get; set; }
        /// <summary>MATERIAL | SERVICE | MIXED, when the reader could tell.</summary>
        public string? InvoiceType { get; set; }
    }
}
