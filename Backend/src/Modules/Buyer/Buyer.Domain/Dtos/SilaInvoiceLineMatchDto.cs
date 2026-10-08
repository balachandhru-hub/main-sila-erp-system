namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// One invoice line and the purchase order line it bills.
    /// </summary>
    public class SilaInvoiceLineMatchDto
    {
        public Guid InvoiceItemId { get; set; }
        public Guid? PurchaseOrderItemId { get; set; }
    }
}
