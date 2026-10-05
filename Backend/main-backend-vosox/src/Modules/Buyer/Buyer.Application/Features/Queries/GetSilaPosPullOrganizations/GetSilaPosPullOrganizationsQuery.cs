using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPosPullOrganizations
{
    /// <summary>The buyer organizations with an active POS sales API (GET_POS_SALE), for the daily pull.</summary>
    public class GetSilaPosPullOrganizationsQuery : IRequest<List<Guid>>
    {
    }
}
