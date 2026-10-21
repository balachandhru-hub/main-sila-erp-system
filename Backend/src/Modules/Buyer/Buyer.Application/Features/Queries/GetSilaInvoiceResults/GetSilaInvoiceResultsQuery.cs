using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceResults
{
    /// <summary>Success text for the invoice postings shown on the current tracker page.</summary>
    public class GetSilaInvoiceResultsQuery : IRequest<SilaInvoiceResultsDto>
    {
        public Guid OrganizationId { get; set; }
        public List<Guid> Ids { get; set; } = new List<Guid>();
    }
}
