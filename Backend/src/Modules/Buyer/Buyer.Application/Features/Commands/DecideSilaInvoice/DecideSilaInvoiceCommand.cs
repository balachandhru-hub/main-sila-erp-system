using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.DecideSilaInvoice
{
    public class DecideSilaInvoiceCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid InvoiceId { get; set; }
        public SilaInvoiceDecisionDto Request { get; set; } = new();
    }
}
