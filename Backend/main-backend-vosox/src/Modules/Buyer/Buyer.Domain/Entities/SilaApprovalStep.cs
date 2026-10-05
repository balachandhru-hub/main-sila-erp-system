using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class SilaApprovalStep : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string ApprovalType { get; set; } = string.Empty;

        [Required]
        public string ReferenceType { get; set; } = string.Empty;

        public Guid ReferenceId { get; set; }

        public int Version { get; set; }

        public Guid UserId { get; set; }

        public int Order { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public string? Comment { get; set; }

        public DateTime? ActedOn { get; set; }
    }
}
