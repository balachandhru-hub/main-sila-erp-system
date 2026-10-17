using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SubmitSilaInvoice
{
    /// <summary>Validates the invoice and either starts approval or posts it. It does not run from the goods receipt.</summary>
    public class SubmitSilaInvoiceCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid InvoiceId { get; set; }
    }
}
