using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaRecipeDashboard
{
    /// <summary>Recipe management overview for the signed-in user.</summary>
    public class GetSilaRecipeDashboardQuery : IRequest<SilaRecipeDashboardDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
    }
}
