namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// The purchase order chosen for an invoice.
    /// </summary>
    public class SilaInvoiceMatchPoDto
    {
        public Guid PurchaseOrderId { get; set; }
    }
}
