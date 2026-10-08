using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    /// <summary>
    /// The approved unit cost (per base unit) of a material at one outlet. It overrides ItemBuyerMaster.UnitCost, the default
    /// price, when costing a recipe for that outlet. Written when a price change for the outlet is approved.
    /// </summary>
    public class MaterialOutletPrice : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        public Guid MaterialId { get; set; }

        public Guid OutletLocationId { get; set; }

        [Precision(18, 4)]
        public decimal UnitCost { get; set; }

        public string? Currency { get; set; }
    }
}
