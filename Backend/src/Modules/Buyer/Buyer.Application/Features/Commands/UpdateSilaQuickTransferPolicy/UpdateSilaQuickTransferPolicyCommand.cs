using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.UpdateSilaQuickTransferPolicy
{
    public class UpdateSilaQuickTransferPolicyCommand : IRequest<SilaQuickTransferPolicyDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaQuickTransferPolicyDto Request { get; set; } = new();
    }
}
