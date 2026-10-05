using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class RecipeIngredient : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("Recipe")]
        public Guid RecipeId { get; set; }

        public Recipe Recipe { get; set; } = null!;

        [Required]
        public string IngredientCode { get; set; } = string.Empty;

        public Guid? MaterialId { get; set; }

        public Guid? SubRecipeId { get; set; }

        [Required]
        public string ItemCode { get; set; } = string.Empty;

        [Required]
        public string ItemName { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal Quantity { get; set; }

        [Required]
        public string Uom { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal BaseQuantity { get; set; }

        [Required]
        public string BaseUom { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal? UnitCost { get; set; }

        [Precision(18, 4)]
        public decimal Cost { get; set; }

        public int Sequence { get; set; }

        // SILA ME release 2
        public int Version { get; set; }
    }
}
