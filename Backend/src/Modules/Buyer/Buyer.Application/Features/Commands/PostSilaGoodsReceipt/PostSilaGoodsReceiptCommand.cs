using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.PostSilaGoodsReceipt
{
    /// <summary>
    /// PROTECTED / FROZEN: GRN preparation. Persists the prepared GRN, then queues FIVE S4-GRN POSTING (101).
    /// Returns the id of the goods receipt.
    /// </summary>
    public class PostSilaGoodsReceiptCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaReceivingGrnWriteDto Request { get; set; } = new();
    }
}
