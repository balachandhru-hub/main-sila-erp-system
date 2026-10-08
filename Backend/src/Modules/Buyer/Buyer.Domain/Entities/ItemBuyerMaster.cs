using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;
namespace Buyer.Domain.Entities
{
    public class ItemBuyerMaster : BaseModel
    {

        [Key]
        [Required]
        public Guid Id { get; set; }
        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }
        public BuyerBusinessProfile BuyerBusinessProfile { get; set; }
        public string Description { get; set; }
        public string MaterialCode { get; set; }
        public string MaterialGroup { get; set; }
        public string ProductType { get; set; }
          public string BaseUnitOfMeasure { get; set; }

        
        public string OrderUnitOfMeasure { get; set; }

      
        public string AlternateUnitOfMeasure { get; set; }

        
        public string ValuationClass { get; set; }

    
        public string UnitOfMeasureMapping { get; set; }

        public string? SubUnit { get; set; }

        public string? MicroUnit { get; set; }

        // SILA ME inventory: cost per base unit, barcode for stock counts, and whether the item is stocked.
        [Precision(18, 4)]
        public decimal? UnitCost { get; set; }

        public string? Currency { get; set; }

        public string? Barcode { get; set; }

        public bool IsInventoryItem { get; set; }

        public ItemBuyerMaster() { }

        // SILA ME release 2
        public string? InventoryType { get; set; }

        public bool BatchManaged { get; set; }

        public bool ExpiryManaged { get; set; }

        public int? ShelfLifeDays { get; set; }

        public bool SerialManaged { get; set; }

        [Precision(18, 4)]
        public decimal? StandardPrice { get; set; }

        [Precision(18, 4)]
        public decimal? MovingAveragePrice { get; set; }

        // SILA ME parity release
        /// <summary>ERP when created by a GET_MATERIAL pull; null for materials created in the Item Master.</summary>
        public string? Source { get; set; }

        /// <summary>Company code of the ERP pull that created or last synced the material.</summary>
        public string? CompanyCode { get; set; }
    }
}