using MediatR;

namespace Buyer.Application.Features.Commands.CopySilaInvoice
{
    /// <summary>A new local invoice with the same document and lines. It is not posted and does not keep the SAP invoice id.</summary>
    public class CopySilaInvoiceCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }
    }
}
