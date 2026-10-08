using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InventoryLocationMaterial : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("InventoryLocation")]
        public Guid LocationId { get; set; }

        public InventoryLocation InventoryLocation { get; set; } = null!;

        public Guid MaterialId { get; set; }

        [Precision(18, 4)]
        public decimal? MinimumStock { get; set; }

        [Precision(18, 4)]
        public decimal? ParLevel { get; set; }

        [Precision(18, 4)]
        public decimal? ReorderPoint { get; set; }

        // SILA ME parity release
        /// <summary>REGULAR (kept in stock) | ON_DEMAND (stocked when needed); null means REGULAR.</summary>
        public string? StockingType { get; set; }

        [Precision(18, 4)]
        public decimal? MaximumStock { get; set; }

        [Precision(18, 4)]
        public decimal? SafetyStock { get; set; }
    }
}
