using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInventoryHome
{
    public class GetSilaInventoryHomeQuery : IRequest<SilaInventoryHomeDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        /// <summary>The location to summarise; the caller's first location when empty.</summary>
        public Guid? LocationId { get; set; }
    }
}
