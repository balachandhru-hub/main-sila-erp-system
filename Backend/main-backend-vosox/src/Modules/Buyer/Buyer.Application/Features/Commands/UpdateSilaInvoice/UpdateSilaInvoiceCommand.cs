using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.UpdateSilaInvoice
{
    /// <summary>
    /// Saves the fields, purchase order and lines the user reviewed; the invoice becomes REVIEWED.
    /// The same supplier invoice number cannot be entered twice.
    /// </summary>
    public class UpdateSilaInvoiceCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }
        public SilaInvoiceWriteDto Request { get; set; } = new();
    }
}
