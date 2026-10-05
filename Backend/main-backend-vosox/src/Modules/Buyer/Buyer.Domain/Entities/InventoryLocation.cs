using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InventoryLocation : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        public Guid PropertyId { get; set; }

        [Required]
        public string LocationCode { get; set; } = string.Empty;

        [Required]
        public string LocationName { get; set; } = string.Empty;

        [Required]
        public string LocationType { get; set; } = string.Empty;

        public Guid? OutletId { get; set; }

        public string? StoreCategory { get; set; }

        public string? StorageLocationCode { get; set; }

        public bool TransferEnabled { get; set; }

        public bool SalesEnabled { get; set; }

        // SILA ME release 2
        public Guid? ParentLocationId { get; set; }

        public string? GlAccount { get; set; }

        public string? CostCenter { get; set; }

        public string? ProfitCenter { get; set; }

        // SILA ME parity release
        public string? Description { get; set; }

        /// <summary>The location holds stock. Null (rows before the parity release) means enabled.</summary>
        public bool? InventoryEnabled { get; set; }

        /// <summary>Recipe / POS consumption is posted here. Null (rows before the parity release) means enabled.</summary>
        public bool? ConsumptionEnabled { get; set; }
    }
}
