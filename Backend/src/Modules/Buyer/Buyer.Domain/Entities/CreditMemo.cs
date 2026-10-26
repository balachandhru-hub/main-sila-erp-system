using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    /// <summary>A credit memo against a posted SILA invoice. Independent of the original invoice row.</summary>
    public class CreditMemo : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public Guid ReferenceInvoiceId { get; set; }

        public string? CreditMemoNumber { get; set; }

        public string? CreditMemoReference { get; set; }

        public string? ReferenceSupplierInvoiceNumber { get; set; }

        public string? ReferenceErpInvoiceId { get; set; }

        public string? ReferenceFiscalYear { get; set; }

        public Guid? SupplierId { get; set; }

        public Guid? SilaSupplierId { get; set; }

        public string? SupplierName { get; set; }

        public Guid? PurchaseOrderId { get; set; }

        public string? PoNumber { get; set; }

        public string? CompanyCode { get; set; }

        public string? Currency { get; set; }

        public DateTime? DocumentDate { get; set; }

        public DateTime? PostingDate { get; set; }

        public DateTime? TaxCalculationDate { get; set; }

        public string? Reason { get; set; }

        [Precision(18, 4)]
        public decimal? GrossAmount { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        /// <summary>Prepared FIVE S4-INVOICE CREDITMEMO values. The SAP body is built from this only.</summary>
        public string? PostingData { get; set; }

        public Guid? ErpPostingId { get; set; }

        public Guid CreatedByUserId { get; set; }

        public ICollection<CreditMemoItem> Items { get; set; } = new List<CreditMemoItem>();
    }
}
