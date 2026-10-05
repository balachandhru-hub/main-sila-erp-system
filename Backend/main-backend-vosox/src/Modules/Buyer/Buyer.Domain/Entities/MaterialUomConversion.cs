using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class MaterialUomConversion : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        public Guid MaterialId { get; set; }

        [Required]
        public string FromUom { get; set; } = string.Empty;

        [Required]
        public string ToUom { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal Factor { get; set; }
    }
}
