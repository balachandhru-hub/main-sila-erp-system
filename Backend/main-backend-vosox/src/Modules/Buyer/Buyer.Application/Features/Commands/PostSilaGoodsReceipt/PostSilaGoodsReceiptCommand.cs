using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.PostSilaGoodsReceipt
{
    /// <summary>
    /// Posts a goods receipt against a purchase order at a receiving store: the accepted quantity goes into stock,
    /// the purchase order lines are marked received and the receipt is queued for the ERP (POST_GRN).
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
