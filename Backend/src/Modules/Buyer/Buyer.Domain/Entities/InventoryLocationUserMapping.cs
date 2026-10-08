using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InventoryLocationUserMapping : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("InventoryLocation")]
        public Guid LocationId { get; set; }

        public InventoryLocation InventoryLocation { get; set; } = null!;

        public Guid UserId { get; set; }
    }
}
