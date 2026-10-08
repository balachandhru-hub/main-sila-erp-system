using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ExtractSilaInvoice
{
    /// <summary>
    /// Reads the invoice file with the buyer's reader (built-in OCR service or the EXTRACT_INVOICE integration) and fills
    /// the invoice fields and lines, matching the purchase order by PO number and the supplier by the purchase order or the
    /// Supplier Master. Every reading is recorded (InvoiceExtraction). A reading that finds nothing marks the invoice
    /// OCR_FAILED; one below the minimum confidence marks it REVIEW_REQUIRED. REREAD keeps the fields the user changed.
    /// </summary>
    public class ExtractSilaInvoiceCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }

        /// <summary>UPLOAD, MANUAL (default) or REREAD.</summary>
        public string Trigger { get; set; } = "MANUAL";
    }
}
