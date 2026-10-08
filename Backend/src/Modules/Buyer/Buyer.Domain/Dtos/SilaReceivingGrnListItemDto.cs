namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A posted goods receipt with the status of its ERP posting.
    /// </summary>
    public class SilaReceivingGrnListItemDto
    {
        public Guid Id { get; set; }
        public string GrnNumber { get; set; } = string.Empty;
        public Guid PurchaseOrderId { get; set; }
        public string PoNumber { get; set; } = string.Empty;
        public string? SupplierName { get; set; }
        public Guid LocationId { get; set; }
        public string? LocationName { get; set; }
        public Guid? InvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? DeliveryNote { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime ReceivedOn { get; set; }
        public int LineCount { get; set; }
        public string? ErpStatus { get; set; }
        public string? ErpReference { get; set; }
    }
}
