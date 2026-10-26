using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.LinkSilaInvoiceGoodsReceipts
{
    /// <summary>Attaches goods receipts of the matched purchase order to the invoice, or clears that link.</summary>
    public class LinkSilaInvoiceGoodsReceiptsCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }
        public SilaInvoiceLinkGrnDto Request { get; set; } = new();
    }
}
