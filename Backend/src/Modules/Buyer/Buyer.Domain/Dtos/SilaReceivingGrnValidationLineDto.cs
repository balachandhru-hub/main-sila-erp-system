namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// One line of a goods receipt check.
    /// </summary>
    public class SilaReceivingGrnValidationLineDto
    {
        public Guid PurchaseOrderItemId { get; set; }
        public int LineNumber { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? Uom { get; set; }
        public decimal OrderedQty { get; set; }
        public decimal OpenQty { get; set; }
        public decimal ReceivedQty { get; set; }
        public decimal AcceptedQty { get; set; }
        /// <summary>Open quantity left after this receipt.</summary>
        public decimal RemainingQty { get; set; }
        /// <summary>Quantity on the invoice line matched to this purchase order line, when an invoice is given.</summary>
        public decimal? InvoiceQty { get; set; }
        public decimal? Value { get; set; }
        /// <summary>False when no Item Master material has the code: received on the PO but not stocked.</summary>
        public bool Stocked { get; set; }
        public List<string> Messages { get; set; } = new();
    }
}
