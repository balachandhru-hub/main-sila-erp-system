namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Received quantity of one purchase order line, in the unit of the line. The accepted quantity goes into stock.
    /// </summary>
    public class SilaReceivingGrnLineWriteDto
    {
        public Guid PurchaseOrderItemId { get; set; }
        public decimal ReceivedQty { get; set; }
        public decimal AcceptedQty { get; set; }
        public decimal RejectedQty { get; set; }
        public decimal DamagedQty { get; set; }
        /// <summary>Required when the material is batch managed (max 40 characters).</summary>
        public string? BatchNumber { get; set; }
        /// <summary>Required when the material is expiry managed; must not have passed.</summary>
        public DateTime? ExpiryDate { get; set; }
    }
}
