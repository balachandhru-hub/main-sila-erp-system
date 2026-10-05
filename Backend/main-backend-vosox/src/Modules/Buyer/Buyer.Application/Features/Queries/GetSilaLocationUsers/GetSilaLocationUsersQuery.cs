using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaLocationUsers
{
    public class GetSilaLocationUsersQuery : IRequest<SilaLocationUsersDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid LocationId { get; set; }
    }
}
