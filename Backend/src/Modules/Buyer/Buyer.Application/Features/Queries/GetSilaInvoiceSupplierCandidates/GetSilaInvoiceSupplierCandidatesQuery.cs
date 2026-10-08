using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceSupplierCandidates
{
    /// <summary>Suppliers the invoice may come from, best match first.</summary>
    public class GetSilaInvoiceSupplierCandidatesQuery : IRequest<List<SilaInvoiceSupplierCandidateDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid InvoiceId { get; set; }
        public string? Search { get; set; }
    }
}
