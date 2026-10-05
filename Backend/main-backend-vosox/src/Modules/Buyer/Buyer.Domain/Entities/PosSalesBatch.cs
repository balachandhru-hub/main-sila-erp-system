using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class PosSalesBatch : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string BatchNumber { get; set; } = string.Empty;

        [Required]
        public string Source { get; set; } = string.Empty;

        public string? FileName { get; set; }

        public int Rows { get; set; }

        public int Accepted { get; set; }

        public int Duplicates { get; set; }

        public int Invalid { get; set; }

        public Guid UploadedBy { get; set; }

        // SILA ME release 2
        public Guid? PosSourceId { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public DateTime? BusinessDateFrom { get; set; }

        public DateTime? BusinessDateTo { get; set; }
    }
}
