using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class GoodsReceiptItem : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("GoodsReceipt")]
        public Guid GoodsReceiptId { get; set; }

        public GoodsReceipt GoodsReceipt { get; set; } = null!;

        public Guid PurchaseOrderItemId { get; set; }

        public Guid? MaterialId { get; set; }

        public string? MaterialCode { get; set; }

        [Required]
        public string MaterialName { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal OrderedQty { get; set; }

        [Precision(18, 4)]
        public decimal ReceivedQty { get; set; }

        [Precision(18, 4)]
        public decimal AcceptedQty { get; set; }

        [Precision(18, 4)]
        public decimal RejectedQty { get; set; }

        [Precision(18, 4)]
        public decimal DamagedQty { get; set; }

        public string? Uom { get; set; }

        // SILA ME parity: open quantity of the PO line before this receipt, quantity billed by the linked invoice,
        // and the batch / expiry of the received goods (required for batch / expiry managed materials).
        [Precision(18, 4)]
        public decimal? OpenQtyBefore { get; set; }

        [Precision(18, 4)]
        public decimal? InvoiceQty { get; set; }

        public string? BatchNumber { get; set; }

        public DateTime? ExpiryDate { get; set; }
    }
}
