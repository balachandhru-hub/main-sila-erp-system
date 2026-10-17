using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.RefreshSilaInvoicePosting
{
    /// <summary>Reads FIVE S4 - GET PO again and replaces the stored posting data. It does not post the invoice.</summary>
    public class RefreshSilaInvoicePostingCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }
    }
}
