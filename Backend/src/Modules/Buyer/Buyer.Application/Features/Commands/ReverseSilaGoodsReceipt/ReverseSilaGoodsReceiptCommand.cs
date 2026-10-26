using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ReverseSilaGoodsReceipt
{
    /// <summary>
    /// Posts GRN reversal via FIVE S4-GRN REVERSAL (movement type 102), then reverses local stock
    /// for the confirmed quantities. Does not change the normal GRN posting mapper.
    /// </summary>
    public class ReverseSilaGoodsReceiptCommand : IRequest<SilaReceivingGrnReversalResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid GoodsReceiptId { get; set; }
        public SilaReceivingGrnReversalWriteDto Request { get; set; } = new();
    }
}
