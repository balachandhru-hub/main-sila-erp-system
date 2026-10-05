using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.MatchSilaInvoiceSupplier
{
    /// <summary>Sets the supplier of an invoice; a linked purchase order of another supplier is unlinked.</summary>
    public class MatchSilaInvoiceSupplierCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }
        public SilaInvoiceMatchSupplierDto Request { get; set; } = new();
    }
}
