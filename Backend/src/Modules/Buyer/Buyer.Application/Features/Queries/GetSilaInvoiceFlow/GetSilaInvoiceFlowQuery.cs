using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceFlow
{
    /// <summary>PO retrieval, invoice submission, response, and attachment request and response for one posting.</summary>
    public class GetSilaInvoiceFlowQuery : IRequest<SilaInvoiceFlowDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid PostingId { get; set; }
    }
}
