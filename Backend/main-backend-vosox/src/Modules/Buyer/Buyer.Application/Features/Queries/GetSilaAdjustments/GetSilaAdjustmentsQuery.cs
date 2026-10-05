using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaAdjustments
{
    public class GetSilaAdjustmentsQuery : IRequest<List<SilaAdjustmentListItemDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid? LocationId { get; set; }
        public string? AdjustmentType { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 50;
    }
}
