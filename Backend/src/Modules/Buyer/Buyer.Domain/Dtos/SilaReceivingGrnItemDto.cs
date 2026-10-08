namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// One goods receipt line. Stocked is false when the line has no Item Master material.
    /// </summary>
    public class SilaReceivingGrnItemDto
    {
        public Guid Id { get; set; }
        public Guid PurchaseOrderItemId { get; set; }
        public Guid? MaterialId { get; set; }
        public string? MaterialCode { get; set; }
        public string MaterialName { get; set; } = string.Empty;
        public decimal OrderedQty { get; set; }
        public decimal ReceivedQty { get; set; }
        public decimal AcceptedQty { get; set; }
        public decimal RejectedQty { get; set; }
        public decimal DamagedQty { get; set; }
        public string? Uom { get; set; }
        public bool Stocked { get; set; }
        /// <summary>Open quantity of the PO line before this receipt.</summary>
        public decimal? OpenQtyBefore { get; set; }
        /// <summary>Quantity billed by the linked invoice for the PO line.</summary>
        public decimal? InvoiceQty { get; set; }
        public string? BatchNumber { get; set; }
        public DateTime? ExpiryDate { get; set; }
    }
}
