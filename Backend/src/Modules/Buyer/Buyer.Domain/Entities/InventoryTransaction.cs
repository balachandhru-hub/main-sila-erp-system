using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InventoryTransaction : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string TransactionNumber { get; set; } = string.Empty;

        [Required]
        public string TransactionType { get; set; } = string.Empty;

        public Guid LocationId { get; set; }

        public Guid MaterialId { get; set; }

        [Required]
        public string Direction { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal Quantity { get; set; }

        [Required]
        public string BaseUom { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal EnteredQuantity { get; set; }

        [Required]
        public string EnteredUom { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal? UnitCost { get; set; }

        [Precision(18, 4)]
        public decimal? Value { get; set; }

        [Required]
        public string ReferenceType { get; set; } = string.Empty;

        public Guid ReferenceId { get; set; }

        public string? ReferenceNumber { get; set; }

        public string? Reason { get; set; }

        public DateTime BusinessDate { get; set; }
    }
}
