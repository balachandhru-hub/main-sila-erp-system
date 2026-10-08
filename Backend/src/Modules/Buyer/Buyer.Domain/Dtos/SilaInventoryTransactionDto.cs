namespace Buyer.Domain.Dtos
{
    /// <summary>One row of the inventory ledger.</summary>
    public class SilaInventoryTransactionDto
    {
        public Guid Id { get; set; }
        public string TransactionNumber { get; set; } = string.Empty;
        public string TransactionType { get; set; } = string.Empty;
        /// <summary>IN | OUT</summary>
        public string Direction { get; set; } = string.Empty;
        public Guid LocationId { get; set; }
        public string? LocationCode { get; set; }
        public string? LocationName { get; set; }
        public Guid MaterialId { get; set; }
        public string? MaterialCode { get; set; }
        public string? MaterialDescription { get; set; }
        /// <summary>Base quantity, always positive.</summary>
        public decimal Quantity { get; set; }
        public string BaseUom { get; set; } = string.Empty;
        public decimal EnteredQuantity { get; set; }
        public string EnteredUom { get; set; } = string.Empty;
        public decimal? UnitCost { get; set; }
        public decimal? Value { get; set; }
        public string ReferenceType { get; set; } = string.Empty;
        public Guid ReferenceId { get; set; }
        public string? ReferenceNumber { get; set; }
        public string? Reason { get; set; }
        public DateTime BusinessDate { get; set; }
        public DateTime DateCreated { get; set; }
    }
}
