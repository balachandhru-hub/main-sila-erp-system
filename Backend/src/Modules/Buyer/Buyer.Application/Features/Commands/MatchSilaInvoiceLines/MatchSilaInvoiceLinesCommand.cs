using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.MatchSilaInvoiceLines
{
    /// <summary>Links invoice lines to lines of the invoice's purchase order.</summary>
    public class MatchSilaInvoiceLinesCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }
        public SilaInvoiceMatchLinesDto Request { get; set; } = new();
    }
}
