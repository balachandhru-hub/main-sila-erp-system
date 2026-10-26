using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ReprocessSilaInvoiceAttachment
{
    /// <summary>Sends FIVE S4 - INVOICE ATTACHMENT again. It does not post the invoice.</summary>
    public class ReprocessSilaInvoiceAttachmentCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }
    }
}
