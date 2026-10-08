using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPhysicalInventories
{
    public class GetSilaPhysicalInventoriesQuery : IRequest<List<SilaPhysicalInventoryDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public string? Status { get; set; }
        public Guid? LocationId { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
