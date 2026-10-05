using MediatR;

namespace Buyer.Application.Features.Commands.CancelSilaPurchaseRequest
{
    public class CancelSilaPurchaseRequestCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid PurchaseRequestId { get; set; }
    }
}
