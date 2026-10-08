using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InternalPurchaseRequest : BaseModel
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

        public Guid MaterialId { get; set; }

        [Precision(18, 4)]
        public decimal Quantity { get; set; }

        [Required]
        public string Uom { get; set; } = string.Empty;

        public string? Reason { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public Guid RequestedBy { get; set; }

        public Guid? WeeklyBucketId { get; set; }

        [Required]
        public string Source { get; set; } = string.Empty;
    }
}
