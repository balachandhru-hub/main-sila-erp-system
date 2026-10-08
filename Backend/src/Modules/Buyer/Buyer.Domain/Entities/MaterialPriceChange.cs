using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class MaterialPriceChange : BaseModel
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

        public Guid MaterialId { get; set; }

        /// <summary>The outlet the price is for; null changes the default price of the material.</summary>
        public Guid? OutletLocationId { get; set; }

        [Precision(18, 4)]
        public decimal? CurrentUnitCost { get; set; }

        [Precision(18, 4)]
        public decimal ProposedUnitCost { get; set; }

        public string? Currency { get; set; }

        public string? PriceUom { get; set; }

        public DateTime? EffectiveFrom { get; set; }

        [Required]
        public string Reason { get; set; } = string.Empty;

        [Required]
        public string Status { get; set; } = string.Empty;

        public Guid RequestedBy { get; set; }

        public DateTime? DecidedOn { get; set; }
    }
}
