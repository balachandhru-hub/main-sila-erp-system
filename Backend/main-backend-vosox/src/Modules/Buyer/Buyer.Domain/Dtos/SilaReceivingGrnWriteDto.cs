namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Goods receipt posted against a purchase order at a receiving store.
    /// </summary>
    public class SilaReceivingGrnWriteDto
    {
        public Guid PurchaseOrderId { get; set; }
        public Guid LocationId { get; set; }
        public Guid? InvoiceId { get; set; }
        public string? DeliveryNote { get; set; }
        public List<SilaReceivingGrnLineWriteDto> Lines { get; set; } = new();
    }
}
