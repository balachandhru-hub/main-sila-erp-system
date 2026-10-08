namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// One purchase order line read from Excel or from the ERP (GET_PO); header fields repeat on every line.
    /// </summary>
    public class SilaPoImportRowDto
    {
        public int RowNumber { get; set; }
        public string? PoNumber { get; set; }
        public string? PoType { get; set; }
        public string? CompanyCode { get; set; }
        public string? SupplierCode { get; set; }
        public string? SupplierName { get; set; }
        public string? Plant { get; set; }
        public string? Currency { get; set; }
        public string? TaxCode { get; set; }
        public string? TotalAmount { get; set; }
        public string? OrderDate { get; set; }
        /// <summary>Expected delivery date (optional).</summary>
        public string? DeliveryDate { get; set; }
        public string? LineNumber { get; set; }
        public string? MaterialCode { get; set; }
        public string? Description { get; set; }
        public string? Quantity { get; set; }
        public string? Uom { get; set; }
        public string? UnitPrice { get; set; }
        public string? ItemCurrency { get; set; }
        public string? ReceivedQuantity { get; set; }
        public string? OpenQuantity { get; set; }
        public string? GoodsReceiptExpected { get; set; }
    }
}
