using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreateSilaInvoice
{
    /// <summary>Creates a draft invoice for the Create Invoice screen (PO or Non-PO).</summary>
    public class CreateSilaInvoiceCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public SilaCreateInvoiceRequestDto Request { get; set; } = new();
    }
}
