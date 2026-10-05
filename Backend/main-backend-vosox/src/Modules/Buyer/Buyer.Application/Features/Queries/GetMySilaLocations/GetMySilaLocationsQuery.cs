using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetMySilaLocations
{
    public class GetMySilaLocationsQuery : IRequest<List<SilaLocationResponseDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
    }
}
