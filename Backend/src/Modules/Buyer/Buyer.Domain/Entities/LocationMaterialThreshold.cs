using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class LocationMaterialThreshold : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("InventoryLocationMaterial")]
        public Guid LocationMaterialId { get; set; }

        public InventoryLocationMaterial InventoryLocationMaterial { get; set; } = null!;

        public int Month { get; set; }

        [Precision(18, 4)]
        public decimal? MinimumStock { get; set; }

        [Precision(18, 4)]
        public decimal? ReorderPoint { get; set; }
    }
}
