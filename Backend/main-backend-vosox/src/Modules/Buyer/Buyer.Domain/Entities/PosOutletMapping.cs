using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class PosOutletMapping : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("PosSource")]
        public Guid PosSourceId { get; set; }

        public PosSource PosSource { get; set; } = null!;

        [Required]
        public string PosOutletCode { get; set; } = string.Empty;

        public string? PosOutletName { get; set; }

        public Guid OutletLocationId { get; set; }
    }
}
