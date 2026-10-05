using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class PhysicalInventoryRequest : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string RequestNumber { get; set; } = string.Empty;

        public Guid LocationId { get; set; }

        public Guid? AlertId { get; set; }

        [Required]
        public string Reason { get; set; } = string.Empty;

        public DateTime ScheduledDate { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public Guid? StockCountId { get; set; }

        public Guid RequestedBy { get; set; }

        public Guid? AssignedUserId { get; set; }
    }
}
