using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class RecipeSubstitutionProposal : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string ProposalNumber { get; set; } = string.Empty;

        public Guid RecipeId { get; set; }

        public Guid IngredientMaterialId { get; set; }

        public Guid SuggestedMaterialId { get; set; }

        public Guid? LocationId { get; set; }

        [Required]
        public string Reason { get; set; } = string.Empty;

        [Required]
        public string Status { get; set; } = string.Empty;

        public int? CreatedVersion { get; set; }

        public Guid? DecidedBy { get; set; }

        public DateTime? DecidedOn { get; set; }
    }
}
