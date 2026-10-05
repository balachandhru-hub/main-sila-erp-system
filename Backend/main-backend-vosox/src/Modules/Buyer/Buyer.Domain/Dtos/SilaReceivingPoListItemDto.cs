namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Open purchase order of the buyer, as listed on the receiving screen.
    /// </summary>
    public class SilaReceivingPoListItemDto
    {
        public Guid Id { get; set; }
        public string PoNumber { get; set; } = string.Empty;
        public Guid SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public DateTime OrderDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? PlantCode { get; set; }
        public string? Currency { get; set; }
        public decimal TotalAmount { get; set; }
        public int LineCount { get; set; }
        public int OpenLineCount { get; set; }
        /// <summary>Company code (entity) of the purchase order.</summary>
        public string? EntityCode { get; set; }
        public DateTime? DeliveryDate { get; set; }
        /// <summary>Sum of the ordered quantities of the active lines.</summary>
        public decimal TotalOrderedQuantity { get; set; }
    }
}
