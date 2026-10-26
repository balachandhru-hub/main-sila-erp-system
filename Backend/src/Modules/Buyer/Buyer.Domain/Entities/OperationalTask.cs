using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    /// <summary>Generic operational work item. Not a permission and not an approval decision.</summary>
    public class OperationalTask : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string TaskType { get; set; } = string.Empty;

        [Required]
        public string SourceModule { get; set; } = string.Empty;

        [Required]
        public string SourceDocumentType { get; set; } = string.Empty;

        public Guid SourceDocumentId { get; set; }

        public string? SourceDocumentNumber { get; set; }

        [Required]
        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        public string Priority { get; set; } = string.Empty;

        [Required]
        public string Status { get; set; } = string.Empty;

        public Guid? AssignedUserId { get; set; }

        public string? AssignedPermission { get; set; }

        public Guid? LocationId { get; set; }

        public DateTime? DueAt { get; set; }

        public DateTime? CompletedAt { get; set; }

        public Guid? CompletedBy { get; set; }

        public string? ActionType { get; set; }

        public string? ActionRoute { get; set; }

        [Required]
        public string DeduplicationKey { get; set; } = string.Empty;

        public Guid? PurchaseOrderId { get; set; }

        public Guid? GoodsReceiptId { get; set; }

        public Guid? InvoiceId { get; set; }

        public Guid? CreditMemoId { get; set; }

        public string? Metadata { get; set; }
    }
}
