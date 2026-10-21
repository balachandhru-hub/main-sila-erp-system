using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaGoodsReceiptReversal
{
    public class GetSilaGoodsReceiptReversalQuery : IRequest<SilaReceivingGrnReversalPreviewDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid GoodsReceiptId { get; set; }
    }
}
