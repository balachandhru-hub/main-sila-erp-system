using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPriceApprovals
{
    /// <summary>The material price changes whose current approval level is the signed-in user's.</summary>
    public class GetSilaPriceApprovalsQuery : IRequest<List<SilaMaterialPriceChangeDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; }
    }
}
