using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class StockCount : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string CountNumber { get; set; } = string.Empty;

        public Guid LocationId { get; set; }

        [Required]
        public string CountType { get; set; } = string.Empty;

        public bool BlindCount { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public string? Notes { get; set; }

        public Guid? SubmittedBy { get; set; }

        public DateTime? SubmittedOn { get; set; }

        public Guid? ApprovedBy { get; set; }

        public DateTime? ApprovedOn { get; set; }

        /// <summary>The trading day the count is for (parity release; null on counts created before it).</summary>
        public DateTime? BusinessDate { get; set; }

        public ICollection<StockCountItem> Items { get; set; } = new List<StockCountItem>();
    }
}
