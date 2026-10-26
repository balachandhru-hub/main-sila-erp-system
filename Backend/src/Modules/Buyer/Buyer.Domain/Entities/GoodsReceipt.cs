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

        /// <summary>Original SAP Material Document (101). Never overwritten by reversal.</summary>
        public string? MaterialDocument { get; set; }

        public string? MaterialDocumentYear { get; set; }

        /// <summary>Latest SAP Material Document created by FIVE S4-GRN REVERSAL (102).</summary>
        public string? ReversalMaterialDocument { get; set; }

        public string? ReversalMaterialDocumentYear { get; set; }

        public Guid? ReversalErpPostingId { get; set; }

        /// <summary>Original GRN when this row is the reversal document (GR**9 linked to GR**8).</summary>
        public Guid? ParentGoodsReceiptId { get; set; }

        /// <summary>Internal GR** number created for the latest successful reversal of this receipt.</summary>
        [MaxLength(20)]
        public string? ReversalGrnNumber { get; set; }

        public Guid? ReversalGoodsReceiptId { get; set; }

        /// <summary>PENDING | POSTED | FAILED | UNKNOWN | FAILED_LOCAL | INVOICE_REQUIRED</summary>
        public string? ReversalStatus { get; set; }

        public string? ReversalReason { get; set; }

        public DateTime? ReversedOn { get; set; }

        public Guid? ReversedBy { get; set; }

        public ICollection<GoodsReceiptItem> Items { get; set; } = new List<GoodsReceiptItem>();
    }
}
