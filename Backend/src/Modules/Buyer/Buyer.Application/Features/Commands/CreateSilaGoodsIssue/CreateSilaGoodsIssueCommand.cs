using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreateSilaGoodsIssue
{
    public class CreateSilaGoodsIssueCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaGoodsIssueWriteDto Request { get; set; } = new();
    }
}
