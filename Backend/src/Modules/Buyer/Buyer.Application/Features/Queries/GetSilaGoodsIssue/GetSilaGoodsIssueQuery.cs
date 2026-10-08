using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaGoodsIssue
{
    public class GetSilaGoodsIssueQuery : IRequest<SilaGoodsIssueDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid GoodsIssueId { get; set; }
    }
}
