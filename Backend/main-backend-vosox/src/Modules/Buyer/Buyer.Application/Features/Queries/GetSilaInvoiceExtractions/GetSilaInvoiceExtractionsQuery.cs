using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceExtractions
{
    /// <summary>Every reading of the invoice, newest first.</summary>
    public class GetSilaInvoiceExtractionsQuery : IRequest<List<SilaInvoiceExtractionDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid InvoiceId { get; set; }
    }
}
