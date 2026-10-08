namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// One line the OCR read from an invoice.
    /// </summary>
    public class SilaInvoiceOcrLineDto
    {
        public string? Description { get; set; }
        public decimal? Quantity { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal? Amount { get; set; }
        public string? Uom { get; set; }
        public string? SupplierMaterialCode { get; set; }
        public decimal? TaxRate { get; set; }
    }
}
