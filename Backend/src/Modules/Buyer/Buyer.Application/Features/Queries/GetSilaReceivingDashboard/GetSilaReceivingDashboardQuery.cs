using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaReceivingDashboard
{
    public class GetSilaReceivingDashboardQuery : IRequest<SilaReceivingDashboardDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid? LocationId { get; set; }
        public Guid? PropertyId { get; set; }
        public string? Supplier { get; set; }
    }
}
