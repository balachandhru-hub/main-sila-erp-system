using Identity.Domain.Dto;
using MediatR;

namespace Identity.Application.Features.Queries.GetAssignableRoles
{
    /// <summary>The roles the signed-in user may give to a user they create.</summary>
    public class GetAssignableRolesQuery : IRequest<List<RoleDto>>
    {
        /// <summary>Role id of the signed-in user (the role claim of the token).</summary>
        public string LoggedInRole { get; set; }
    }
}
