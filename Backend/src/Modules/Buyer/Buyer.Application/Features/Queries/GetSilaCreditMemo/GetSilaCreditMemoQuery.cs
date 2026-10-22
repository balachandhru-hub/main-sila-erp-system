using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaCreditMemo
{
    public class GetSilaCreditMemoQuery : IRequest<SilaCreditMemoDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid CreditMemoId { get; set; }
    }
}
