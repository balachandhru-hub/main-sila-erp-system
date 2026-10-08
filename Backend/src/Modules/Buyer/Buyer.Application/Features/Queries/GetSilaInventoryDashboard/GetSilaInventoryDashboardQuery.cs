using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInventoryDashboard
{
    public class GetSilaInventoryDashboardQuery : IRequest<SilaInventoryDashboardDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid? PropertyId { get; set; }
        /// <summary>A store or outlet, or a venue (its stores and outlets).</summary>
        public Guid? LocationId { get; set; }
        /// <summary>STORE | OUTLET</summary>
        public string? LocationType { get; set; }
        /// <summary>Part of the Item Master material group.</summary>
        public string? MaterialGroup { get; set; }

        /// <summary>Day of the movement figures (today when empty); consumption covers the 7 days up to it.</summary>
        public DateTime? BusinessDate { get; set; }
    }
}
