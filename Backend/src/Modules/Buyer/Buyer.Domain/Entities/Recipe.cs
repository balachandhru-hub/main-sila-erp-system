using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class Recipe : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string RecipeCode { get; set; } = string.Empty;

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        public string? Category { get; set; }

        [Required]
        public string ItemMode { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal ServingQty { get; set; }

        [Required]
        public string ServingUom { get; set; } = string.Empty;

        [Required]
        public string SellingUom { get; set; } = string.Empty;

        public string? PosCode { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public int Version { get; set; }

        [Precision(18, 4)]
        public decimal TotalCost { get; set; }

        public string? Currency { get; set; }

        public Guid? SubmittedBy { get; set; }

        public DateTime? SubmittedOn { get; set; }

        public DateTime? ApprovedOn { get; set; }

        public ICollection<RecipeIngredient> Ingredients { get; set; } = new List<RecipeIngredient>();

        public ICollection<RecipeOutletPrice> OutletPrices { get; set; } = new List<RecipeOutletPrice>();


        // SILA ME release 2
        public Guid? FamilyId { get; set; }

        public Guid? CategoryId { get; set; }

        public int ActiveVersion { get; set; }

        // Header of the pending (unapproved) version of an approved recipe. Name, PosCode, ServingQty, ServingUom and
        // SellingUom above stay the active version's values (POS matching and consumption use them) until the pending
        // version is approved. DraftServingQty != null marks a pending header (DraftPosCode may then be null = no POS code).
        public string? DraftName { get; set; }

        public string? DraftPosCode { get; set; }

        [Precision(18, 4)]
        public decimal? DraftServingQty { get; set; }

        public string? DraftServingUom { get; set; }

        public string? DraftSellingUom { get; set; }

        // SILA ME parity: cost of the pending version (TotalCost keeps the selling version's cost), the POS item
        // description shown next to the POS code, and the business date of the last POS sale consumed for the recipe.
        [Precision(18, 4)]
        public decimal? DraftTotalCost { get; set; }

        public string? PosItem { get; set; }

        public DateTime? LastSaleDate { get; set; }
    }
}
