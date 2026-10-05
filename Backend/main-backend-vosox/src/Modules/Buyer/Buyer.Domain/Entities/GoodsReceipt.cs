using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class GoodsReceipt : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string GrnNumber { get; set; } = string.Empty;

        public Guid PurchaseOrderId { get; set; }

        [Required]
        public string PoNumber { get; set; } = string.Empty;

        public Guid LocationId { get; set; }

        public Guid? InvoiceId { get; set; }

        public string? DeliveryNote { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public Guid ReceivedBy { get; set; }

        public Guid? ErpPostingId { get; set; }

        public ICollection<GoodsReceiptItem> Items { get; set; } = new List<GoodsReceiptItem>();
    }
}
