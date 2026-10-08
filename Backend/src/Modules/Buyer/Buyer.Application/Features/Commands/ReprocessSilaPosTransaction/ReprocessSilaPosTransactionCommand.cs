using MediatR;

namespace Buyer.Application.Features.Commands.ReprocessSilaPosTransaction
{
    public class ReprocessSilaPosTransactionCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid TransactionId { get; set; }
    }
}
