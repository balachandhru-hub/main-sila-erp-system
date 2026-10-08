using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InventoryBalance : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        public Guid LocationId { get; set; }

        public Guid MaterialId { get; set; }

        [Precision(18, 4)]
        public decimal OnHandQty { get; set; }

        [Precision(18, 4)]
        public decimal InTransitQty { get; set; }

        [Required]
        public string BaseUom { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal? UnitCost { get; set; }

        public DateTime? LastMovementOn { get; set; }

        // SILA ME release 2
        // Optimistic concurrency: a parallel update of the same row fails instead of overwriting it.
        [Timestamp]
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    }
}
