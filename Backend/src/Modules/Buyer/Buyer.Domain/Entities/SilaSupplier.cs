using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class SilaSupplier : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string SupplierCode { get; set; } = string.Empty;

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? TaxNumber { get; set; }

        public string? Aliases { get; set; }

        public string? Country { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public Guid? SupplierOrganizationId { get; set; }

        // SILA ME parity: legal (registered) name, city, address and default currency of the supplier.
        public string? LegalName { get; set; }

        public string? City { get; set; }

        public string? Address { get; set; }

        public string? Currency { get; set; }
    }
}
