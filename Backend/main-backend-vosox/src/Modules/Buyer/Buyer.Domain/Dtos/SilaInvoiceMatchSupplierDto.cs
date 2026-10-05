namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// The supplier chosen for an invoice: a Supplier Master row, or a supplier of the purchase orders.
    /// </summary>
    public class SilaInvoiceMatchSupplierDto
    {
        public Guid? SilaSupplierId { get; set; }
        public Guid? SupplierId { get; set; }
    }
}
