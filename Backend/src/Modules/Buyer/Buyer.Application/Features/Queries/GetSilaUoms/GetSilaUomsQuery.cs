using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaUoms
{
    /// <summary>The units of measure in use: Item Master base/order/alternate units, conversion units and serving defaults.</summary>
    public class GetSilaUomsQuery : IRequest<List<string>>
    {
        public Guid OrganizationId { get; set; }
    }
}
