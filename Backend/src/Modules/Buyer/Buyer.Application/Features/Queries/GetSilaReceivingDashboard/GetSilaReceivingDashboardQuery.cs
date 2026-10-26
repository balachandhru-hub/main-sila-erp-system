using Buyer.Domain.Dtos;
using MediatR;
using System.Collections.Generic;

namespace Buyer.Application.Features.Queries.GetSilaReceivingDashboard
{
    public class GetSilaReceivingDashboardQuery : IRequest<SilaReceivingDashboardDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        /// <summary>Authenticated Identity permission codes. Used to hide modules the caller cannot view.</summary>
        public List<string> PermissionCodes { get; set; } = new();
        public Guid? LocationId { get; set; }
        public Guid? PropertyId { get; set; }
        public string? Supplier { get; set; }
    }
}
