using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ReverseSilaGoodsReceipt
{
    /// <summary>
    /// Cancels the original SAP Material Document (101 → 102 via Cancel), then reverses local stock.
    /// Does not change the normal GRN posting mapper.
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
