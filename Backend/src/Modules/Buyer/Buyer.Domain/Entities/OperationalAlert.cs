using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    /// <summary>Generic operational alert. InventoryAlert remains stock-specific.</summary>
    public class OperationalAlert : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string AlertType { get; set; } = string.Empty;

        [Required]
        public string SourceModule { get; set; } = string.Empty;

        [Required]
        public string SourceDocumentType { get; set; } = string.Empty;

        public Guid SourceDocumentId { get; set; }

        [Required]
        public string Severity { get; set; } = string.Empty;

        [Required]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Message { get; set; } = string.Empty;

        [Required]
        public string Status { get; set; } = string.Empty;

        public Guid? RecipientUserId { get; set; }

        public string? RecipientPermission { get; set; }

        public Guid? LocationId { get; set; }

        public DateTime? AcknowledgedAt { get; set; }

        public Guid? AcknowledgedBy { get; set; }

        [Required]
        public string DeduplicationKey { get; set; } = string.Empty;

        public string? ActionRoute { get; set; }

        public Guid? PurchaseOrderId { get; set; }

        public Guid? GoodsReceiptId { get; set; }

        public Guid? InvoiceId { get; set; }

        public Guid? CreditMemoId { get; set; }

        public string? Metadata { get; set; }
    }
}
