using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class StockShortageEnquiry : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string EnquiryNumber { get; set; } = string.Empty;

        public Guid StockCountId { get; set; }

        public Guid StockCountItemId { get; set; }

        public Guid MaterialId { get; set; }

        [Required]
        public string MaterialCode { get; set; } = string.Empty;

        [Required]
        public string MaterialName { get; set; } = string.Empty;

        public Guid LocationId { get; set; }

        [Precision(18, 4)]
        public decimal ShortageQty { get; set; }

        [Required]
        public string Uom { get; set; } = string.Empty;

        [Required]
        public string Status { get; set; } = string.Empty;

        public string? JustificationCategory { get; set; }

        public string? Response { get; set; }

        public string? ReviewComment { get; set; }

        public Guid? RespondedBy { get; set; }

        public DateTime? RespondedOn { get; set; }

        public Guid? ReviewedBy { get; set; }

        public DateTime? ReviewedOn { get; set; }
    }
}
