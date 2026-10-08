using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// One stock movement of one material at one location, posted by <see cref="InventoryLedger"/>.
    /// BaseQuantity is always positive; Direction says whether stock comes in or goes out.
    /// </summary>
    public class InventoryMovement
    {
        public Guid LocationId { get; set; }
        public ItemBuyerMaster Material { get; set; } = null!;
        public string Direction { get; set; } = string.Empty;
        public string TransactionType { get; set; } = string.Empty;
        public decimal BaseQuantity { get; set; }
        public decimal EnteredQuantity { get; set; }
        public string? EnteredUom { get; set; }
        public decimal? UnitCost { get; set; }
        public string ReferenceType { get; set; } = string.Empty;
        public Guid ReferenceId { get; set; }
        public string? ReferenceNumber { get; set; }
        public string? Reason { get; set; }
        public DateTime? BusinessDate { get; set; }
    }
}
