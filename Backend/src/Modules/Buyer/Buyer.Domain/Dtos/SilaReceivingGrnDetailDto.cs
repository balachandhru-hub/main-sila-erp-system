namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A goods receipt with its lines and ERP posting.
    /// </summary>
    public class SilaReceivingGrnDetailDto
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
        public Guid ReceivedBy { get; set; }
        public DateTime ReceivedOn { get; set; }
        public SilaErpPostingListItemDto? ErpPosting { get; set; }
        public List<SilaReceivingGrnItemDto> Items { get; set; } = new();
    }
}
