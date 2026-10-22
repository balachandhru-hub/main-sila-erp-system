using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.LookupSilaCreditMemoInvoice
{
    public class LookupSilaCreditMemoInvoiceQuery : IRequest<List<SilaCreditMemoReferenceInvoiceDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid? InvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? ErpInvoiceId { get; set; }
        public int Limit { get; set; } = 20;
    }
}
