using Identity.Domain.Dto;
using MediatR;

namespace Identity.Application.Features.Queries.GetInternalOrganizationUsers
{
    /// <summary>
    /// The active users of one organization that hold one role. Used by service-to-service calls (scheduler jobs) that have
    /// no signed-in user, for example to email the store managers of a buyer.
    /// </summary>
    public class GetInternalOrganizationUsersQuery : IRequest<List<UserListDto>>
    {
        public Guid OrganizationId { get; set; }

        /// <summary>The role name, for example STORE_MANAGER.</summary>
        public string Role { get; set; } = string.Empty;
    }
}
