using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaGoodsIssueFromBucket
{
    public class GetSilaGoodsIssueFromBucketQuery : IRequest<SilaGoodsIssueBucketDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid OutletLocationId { get; set; }
    }
}
