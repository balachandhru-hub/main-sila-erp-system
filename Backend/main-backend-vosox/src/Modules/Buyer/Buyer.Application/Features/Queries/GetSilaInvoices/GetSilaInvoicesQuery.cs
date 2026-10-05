using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInvoices
{
    /// <summary>
    /// Uploaded supplier invoices of the buyer, newest first, searched by invoice number, supplier or PO number.
    /// </summary>
    public class GetSilaInvoicesQuery : IRequest<List<SilaInvoiceListItemDto>>
    {
        public Guid OrganizationId { get; set; }
        public string? Search { get; set; }
        public string? Status { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
