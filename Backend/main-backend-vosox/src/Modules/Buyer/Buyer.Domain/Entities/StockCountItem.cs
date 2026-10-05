using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class StockCountItem : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("StockCount")]
        public Guid StockCountId { get; set; }

        public StockCount StockCount { get; set; } = null!;

        public Guid MaterialId { get; set; }

        [Required]
        public string MaterialCode { get; set; } = string.Empty;

        [Required]
        public string MaterialName { get; set; } = string.Empty;

        [Required]
        public string BaseUom { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal SystemQty { get; set; }

        [Precision(18, 4)]
        public decimal? CountedQty { get; set; }

        [Precision(18, 4)]
        public decimal? VarianceQty { get; set; }

        [Precision(18, 4)]
        public decimal? UnitCost { get; set; }

        [Precision(18, 4)]
        public decimal? VarianceValue { get; set; }

        public string? CountMethod { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public Guid? CountedBy { get; set; }

        public DateTime? CountedOn { get; set; }

        // SILA ME release 2
        public string? ReviewComment { get; set; }

        public bool RecountRequested { get; set; }

        /// <summary>Cost controller decision on the line: ACCEPTED, REJECTED (variance not posted) or MORE_INFORMATION_REQUIRED.</summary>
        public string? ReviewStatus { get; set; }
    }
}
