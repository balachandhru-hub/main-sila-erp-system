using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.RemoveSilaInvoiceAttachment
{
    public class RemoveSilaInvoiceAttachmentCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }
    }
}
