using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaMaterialErpRoute
{
    /// <summary>The GET_MATERIAL API a pull for the company code would use, and when it last synced.</summary>
    public class GetSilaMaterialErpRouteQuery : IRequest<SilaMaterialErpRouteDto>
    {
        public Guid OrganizationId { get; set; }
        public string? CompanyCode { get; set; }
    }
}
