using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class PosSource : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string PosSystem { get; set; } = string.Empty;

        [Required]
        public string IntegrationKind { get; set; } = string.Empty;

        public bool IsDefault { get; set; }

        public ICollection<PosOutletMapping> OutletMappings { get; set; } = new List<PosOutletMapping>();

        public ICollection<PosItemMapping> ItemMappings { get; set; } = new List<PosItemMapping>();
    }
}
