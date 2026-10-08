using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InventoryWorkflowEvent : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string ReferenceType { get; set; } = string.Empty;

        public Guid ReferenceId { get; set; }

        [Required]
        public string Action { get; set; } = string.Empty;

        public string? Comment { get; set; }

        public Guid ActorUserId { get; set; }
    }
}
