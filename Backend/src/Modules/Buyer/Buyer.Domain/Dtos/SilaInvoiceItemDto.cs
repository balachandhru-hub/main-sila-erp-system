namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// One invoice line, read by the OCR or typed by the user.
    /// </summary>
    public class SilaInvoiceItemDto
    {
        public Guid? Id { get; set; }
        public int LineNumber { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal? Quantity { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal? Amount { get; set; }
        public Guid? PurchaseOrderItemId { get; set; }
        public string? Uom { get; set; }
        public string? SupplierMaterialCode { get; set; }
        /// <summary>Tax rate in percent (5 = 5 %).</summary>
        public decimal? TaxRate { get; set; }
        /// <summary>MATCHED (set or confirmed by a user) | SUGGESTED (proposed by the automatic match) | UNMATCHED. Read only.</summary>
        public string? MatchStatus { get; set; }
    }
}
