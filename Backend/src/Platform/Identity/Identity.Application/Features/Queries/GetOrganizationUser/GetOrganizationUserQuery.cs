using Identity.Domain.Dto;
using MediatR;

namespace Identity.Application.Features.Queries.GetOrganizationUser
{
    public class GetOrganizationUserQuery : IRequest<List<UserListDto>>
    {
        public Guid? OrganizationId { get; set; }

        public string LoggedInRole { get; set; }

        /// <summary>The signed-in user's organization; other organizations are only for platform and network admins.</summary>
        public Guid CallerOrganizationId { get; set; }

        /// <summary>Also return buyer administrators (notification recipients), not only the users they manage.</summary>
        public bool IncludeAdministrators { get; set; }
    }
}