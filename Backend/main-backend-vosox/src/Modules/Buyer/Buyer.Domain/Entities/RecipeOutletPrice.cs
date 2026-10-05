using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class RecipeOutletPrice : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("Recipe")]
        public Guid RecipeId { get; set; }

        public Recipe Recipe { get; set; } = null!;

        public Guid OutletLocationId { get; set; }

        [Precision(18, 4)]
        public decimal MenuPrice { get; set; }

        public string? Currency { get; set; }

        // SILA ME release 2
        public int Version { get; set; }
    }
}
