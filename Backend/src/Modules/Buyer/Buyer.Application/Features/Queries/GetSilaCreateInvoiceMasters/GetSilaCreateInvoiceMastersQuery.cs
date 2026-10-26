using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaCreateInvoiceMasters
{
    public class GetSilaCreateInvoiceMastersQuery : IRequest<SilaCreateInvoiceMastersDto>
    {
        public Guid OrganizationId { get; set; }
    }
}
