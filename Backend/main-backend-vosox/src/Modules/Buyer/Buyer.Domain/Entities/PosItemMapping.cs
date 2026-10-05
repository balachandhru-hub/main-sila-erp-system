using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class PosItemMapping : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("PosSource")]
        public Guid PosSourceId { get; set; }

        public PosSource PosSource { get; set; } = null!;

        [Required]
        public string PosItemCode { get; set; } = string.Empty;

        public string? PosItemDescription { get; set; }

        public Guid RecipeId { get; set; }
    }
}
