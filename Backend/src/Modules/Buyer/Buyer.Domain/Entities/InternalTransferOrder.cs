using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InternalTransferOrder : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string ItoNumber { get; set; } = string.Empty;

        [Required]
        public string Mode { get; set; } = string.Empty;

        public Guid FromLocationId { get; set; }

        public Guid ToLocationId { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public string? Reason { get; set; }

        public DateTime? RequiredBy { get; set; }

        public Guid RequestedBy { get; set; }

        public Guid? ApprovedBy { get; set; }

        public DateTime? ApprovedOn { get; set; }

        public Guid? DispatchedBy { get; set; }

        public DateTime? DispatchedOn { get; set; }

        public Guid? ReceivedBy { get; set; }

        public DateTime? ReceivedOn { get; set; }

        public string? Comment { get; set; }

        public ICollection<InternalTransferOrderItem> Items { get; set; } = new List<InternalTransferOrderItem>();

        // SILA ME release 2
        public bool AlreadyCollected { get; set; }

        public string? DisputeReason { get; set; }
    }
}
