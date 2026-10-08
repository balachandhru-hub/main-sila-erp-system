using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class GoodsIssueItem : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("GoodsIssue")]
        public Guid GoodsIssueId { get; set; }

        public GoodsIssue GoodsIssue { get; set; } = null!;

        public Guid MaterialId { get; set; }

        [Required]
        public string MaterialCode { get; set; } = string.Empty;

        [Required]
        public string MaterialName { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal Quantity { get; set; }

        [Required]
        public string Uom { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal BaseQuantity { get; set; }
    }
}
