using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPurchaseRequests
{
    public class GetSilaPurchaseRequestsQuery : IRequest<List<SilaPurchaseRequestDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public string? Status { get; set; }
        public Guid? LocationId { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 50;
    }
}
