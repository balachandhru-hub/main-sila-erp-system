using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInvoicePoCandidates
{
    /// <summary>Open purchase orders of the invoice's supplier.</summary>
    public class GetSilaInvoicePoCandidatesQuery : IRequest<List<SilaReceivingPoListItemDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid InvoiceId { get; set; }
        public string? Search { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
