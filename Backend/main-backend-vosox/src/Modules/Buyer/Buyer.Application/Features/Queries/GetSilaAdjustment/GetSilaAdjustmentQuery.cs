using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaAdjustment
{
    public class GetSilaAdjustmentQuery : IRequest<SilaAdjustmentDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid AdjustmentId { get; set; }
    }
}
