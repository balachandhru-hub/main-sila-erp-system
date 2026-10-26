using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.MatchSilaInvoicePurchaseOrder
{
    /// <summary>Links an invoice to an open purchase order of its supplier and matches the lines.</summary>
    public class MatchSilaInvoicePurchaseOrderCommand : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvoiceId { get; set; }
        /// <summary>Keeps the purchase order already on the invoice and matches only the lines that are still open.</summary>
        public bool Append { get; set; }
        public SilaInvoiceMatchPoDto Request { get; set; } = new();
    }
}
