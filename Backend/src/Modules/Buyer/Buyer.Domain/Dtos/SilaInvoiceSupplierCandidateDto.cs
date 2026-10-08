namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A supplier the invoice may come from: a Supplier Master row or a supplier of the buyer's purchase orders.
    /// </summary>
    public class SilaInvoiceSupplierCandidateDto
    {
        public Guid? SilaSupplierId { get; set; }
        /// <summary>The supplier id the purchase orders carry, when known.</summary>
        public Guid? SupplierId { get; set; }
        public string? SupplierCode { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? TaxNumber { get; set; }
        /// <summary>MASTER or PURCHASE_ORDER.</summary>
        public string Source { get; set; } = string.Empty;
        /// <summary>0-100, higher is a better match.</summary>
        public int Score { get; set; }
        public string Reason { get; set; } = string.Empty;
    }
}
