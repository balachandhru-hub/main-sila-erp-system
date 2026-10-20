using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.RefreshSilaInvoicePosting
{
    /// <summary>
    /// PROTECTED / FROZEN: explicit REFRESH POSTING DATA FROM S/4.
    /// This is the only invoice path that calls FIVE S4 - GET PO. It does not post the invoice.
    /// </summary>
    public class RefreshSilaInvoicePostingCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }
    }
}
