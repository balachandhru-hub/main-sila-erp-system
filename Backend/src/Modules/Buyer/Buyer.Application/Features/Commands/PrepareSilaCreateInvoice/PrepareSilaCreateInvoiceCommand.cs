using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.PrepareSilaCreateInvoice
{
    /// <summary>
    /// Saves Create Invoice header and lines, links GRNs for PO mode, and stores posting data for FIVE S4-INVOICE POSTING.
    /// </summary>
    public class PrepareSilaCreateInvoiceCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }
        public SilaCreateInvoiceRequestDto Request { get; set; } = new();
    }
}
