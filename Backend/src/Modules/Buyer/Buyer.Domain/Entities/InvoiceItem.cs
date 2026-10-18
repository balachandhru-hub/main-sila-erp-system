using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InvoiceItem : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("Invoice")]
        public Guid InvoiceId { get; set; }

        public Invoice Invoice { get; set; } = null!;

        public int LineNumber { get; set; }

        [Required]
        public string Description { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal? Quantity { get; set; }

        [Precision(18, 4)]
        public decimal? UnitPrice { get; set; }

        [Precision(18, 4)]
        public decimal? Amount { get; set; }

        public Guid? PurchaseOrderItemId { get; set; }

        // SILA ME parity: unit, supplier material code and tax rate as read, and how the PO line was set:
        // MATCHED (by a user), SUGGESTED (proposed by the automatic match), UNMATCHED.
        public string? Uom { get; set; }

        public string? SupplierMaterialCode { get; set; }

        [Precision(9, 4)]
        public decimal? TaxRate { get; set; }

        public string? MatchStatus { get; set; }

        /// <summary>Tax code on the invoice line. For PO invoices the PO item tax code is preferred when this is empty.</summary>
        public string? TaxCode { get; set; }

        /// <summary>Non-PO GL / account-assignment fields for to_SupplierInvoiceItemGLAcct. Unused on PO invoices.</summary>
        public string? GlAccount { get; set; }

        public string? CostCenter { get; set; }

        public string? ProfitCenter { get; set; }

        public string? InternalOrder { get; set; }

        public string? WbsElement { get; set; }

        public string? BusinessArea { get; set; }

        public string? AssignmentReference { get; set; }

        public string? DebitCreditCode { get; set; }

        public string? LineText { get; set; }

        /// <summary>Goods receipt line this invoice quantity is taken from. Null for Non-PO and for OCR lines not yet linked.</summary>
        public Guid? GoodsReceiptItemId { get; set; }
    }
}
