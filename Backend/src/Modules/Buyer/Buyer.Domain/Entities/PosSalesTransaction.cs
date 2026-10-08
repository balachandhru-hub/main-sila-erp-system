using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class PosSalesTransaction : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        public Guid? BatchId { get; set; }

        [Required]
        public string SourceTransactionId { get; set; } = string.Empty;

        public int LineNumber { get; set; }

        public DateTime BusinessDate { get; set; }

        [Required]
        public string OutletCode { get; set; } = string.Empty;

        public Guid? OutletLocationId { get; set; }

        [Required]
        public string PosCode { get; set; } = string.Empty;

        public Guid? RecipeId { get; set; }

        [Precision(18, 4)]
        public decimal QuantitySold { get; set; }

        [Precision(18, 4)]
        public decimal? Amount { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public string? FailedStep { get; set; }

        public string? FailureMessage { get; set; }

        public Guid? ErpPostingId { get; set; }

        // SILA ME release 2
        public string? Uom { get; set; }

        public string? Currency { get; set; }

        // SILA ME parity: the recipe version (the active version at matching) whose ingredients were consumed.
        public int? RecipeVersion { get; set; }
    }
}
