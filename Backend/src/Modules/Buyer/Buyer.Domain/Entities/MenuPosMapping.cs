using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    /// <summary>POS item to Menu Item. Separate from PosItemMapping (POS to Recipe).</summary>
    public class MenuPosMapping : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string PosCode { get; set; } = string.Empty;

        public string? PosDescription { get; set; }

        public Guid? OutletLocationId { get; set; }

        public Guid? MenuItemId { get; set; }

        public DateTime? EffectiveFrom { get; set; }

        public DateTime? EffectiveTo { get; set; }

        [Required]
        public string Status { get; set; } = "UNMAPPED";

        public string? MappingSource { get; set; }

        public decimal? SuggestionConfidence { get; set; }

        public Guid? SuggestedMenuItemId { get; set; }
    }
}
