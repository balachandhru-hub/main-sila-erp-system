using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InvoiceExtraction : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("Invoice")]
        public Guid InvoiceId { get; set; }

        public Invoice Invoice { get; set; } = null!;

        public int Attempt { get; set; }

        [Required]
        public string Trigger { get; set; } = string.Empty;

        [Required]
        public string Method { get; set; } = string.Empty;

        [Required]
        public string Status { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal? Confidence { get; set; }

        public string? Message { get; set; }

        public string? FieldsJson { get; set; }

        // SILA ME parity: who read the file (BUILT_IN, EXTERNAL, or CACHED = reading of an identical file reused),
        // how long it took, and the SHA-256 of the file read.
        public string? Provider { get; set; }

        public int? DurationMs { get; set; }

        public string? ContentHash { get; set; }
    }
}
