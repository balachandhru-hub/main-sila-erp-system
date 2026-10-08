using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class StockAdjustment : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string AdjustmentNumber { get; set; } = string.Empty;

        public Guid LocationId { get; set; }

        [Required]
        public string AdjustmentType { get; set; } = string.Empty;

        public string? Reason { get; set; }

        public Guid PostedBy { get; set; }

        public ICollection<StockAdjustmentItem> Items { get; set; } = new List<StockAdjustmentItem>();
    }
}
