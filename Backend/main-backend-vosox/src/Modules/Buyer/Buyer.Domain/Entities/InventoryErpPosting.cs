using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InventoryErpPosting : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string ReferenceType { get; set; } = string.Empty;

        public Guid ReferenceId { get; set; }

        [Required]
        public string ReferenceNumber { get; set; } = string.Empty;

        public Guid? LocationId { get; set; }

        [Required]
        public string MovementType { get; set; } = string.Empty;

        [Required]
        public string Status { get; set; } = string.Empty;

        public int Attempts { get; set; }

        public string? ErpReference { get; set; }

        public string? ErrorMessage { get; set; }

        public DateTime? PostedOn { get; set; }

        // SILA ME release 2
        public string? CompanyCode { get; set; }

        // SILA ME parity: the last call to the ERP, for the transaction tracker. Payloads are sanitised (credential
        // values masked) and truncated to 4000 characters before they are stored.
        public int? ErpHttpStatus { get; set; }

        public string? ErpRequestPayload { get; set; }

        public string? ErpResponsePayload { get; set; }

        public string? IntegrationSystem { get; set; }
    }
}
