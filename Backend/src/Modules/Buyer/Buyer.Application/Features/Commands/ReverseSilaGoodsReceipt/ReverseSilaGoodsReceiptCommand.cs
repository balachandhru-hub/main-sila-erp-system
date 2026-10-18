using MediatR;

namespace Buyer.Application.Features.Commands.ReverseSilaGoodsReceipt
{
    /// <summary>
    /// Reverses a posted goods receipt in SILA stock and restores open PO quantity.
    /// A supplier invoice already posted to SAP must be reversed first.
    /// </summary>
    public class ReverseSilaGoodsReceiptCommand : IRequest<string>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid GoodsReceiptId { get; set; }
    }
}
