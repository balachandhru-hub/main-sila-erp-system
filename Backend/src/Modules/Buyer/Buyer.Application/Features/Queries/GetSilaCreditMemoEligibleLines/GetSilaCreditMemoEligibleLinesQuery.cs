using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaCreditMemoEligibleLines
{
    public class GetSilaCreditMemoEligibleLinesQuery : IRequest<List<SilaCreditMemoEligibleLineDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid InvoiceId { get; set; }
    }
}
