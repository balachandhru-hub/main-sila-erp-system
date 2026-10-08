using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaGoodsReceipt
{
    /// <summary>
    /// One goods receipt with its lines and the status of its ERP posting.
    /// </summary>
    public class GetSilaGoodsReceiptQuery : IRequest<SilaReceivingGrnDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid GoodsReceiptId { get; set; }
    }
}
