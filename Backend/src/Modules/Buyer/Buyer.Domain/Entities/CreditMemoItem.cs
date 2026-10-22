using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class CreditMemoItem : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("CreditMemo")]
        public Guid CreditMemoId { get; set; }

        public CreditMemo CreditMemo { get; set; } = null!;

        public Guid? ReferenceInvoiceLineId { get; set; }

        public int LineNumber { get; set; }

        public string? PoNumber { get; set; }

        public string? PoItem { get; set; }

        public string? Material { get; set; }

        [Required]
        public string Description { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal? Quantity { get; set; }

        public string? Uom { get; set; }

        [Precision(18, 4)]
        public decimal? Amount { get; set; }

        public string? TaxCode { get; set; }

        public string? Reason { get; set; }
    }
}
