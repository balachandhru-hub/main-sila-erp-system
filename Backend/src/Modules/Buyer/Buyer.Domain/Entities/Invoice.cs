using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class Invoice : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        public string? InvoiceNumber { get; set; }

        public Guid? SupplierId { get; set; }

        public string? SupplierName { get; set; }

        public DateTime? InvoiceDate { get; set; }

        public string? Currency { get; set; }

        [Precision(18, 4)]
        public decimal? GrossAmount { get; set; }

        public Guid? PurchaseOrderId { get; set; }

        public string? PoNumber { get; set; }

        [Required]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        public string FileName { get; set; } = string.Empty;

        [Required]
        public string Status { get; set; } = string.Empty;

        public string? OcrText { get; set; }

        [Precision(18, 4)]
        public decimal? OcrConfidence { get; set; }

        public Guid UploadedBy { get; set; }

        public ICollection<InvoiceItem> Items { get; set; } = new List<InvoiceItem>();

        // SILA ME release 2
        public Guid? SilaSupplierId { get; set; }

        public Guid? ErpPostingId { get; set; }

        // SILA ME parity: MATERIAL | SERVICE | MIXED (a SERVICE invoice gets no goods receipt), the net and tax amounts,
        // the supplier tax number (TRN) as read or corrected, and the SHA-256 of the file (reuse of a cached OCR result).
        public string? InvoiceType { get; set; }

        [Precision(18, 4)]
        public decimal? NetAmount { get; set; }

        [Precision(18, 4)]
        public decimal? TaxAmount { get; set; }

        public string? SupplierTaxNumber { get; set; }

        public string? ContentHash { get; set; }
    }
}
