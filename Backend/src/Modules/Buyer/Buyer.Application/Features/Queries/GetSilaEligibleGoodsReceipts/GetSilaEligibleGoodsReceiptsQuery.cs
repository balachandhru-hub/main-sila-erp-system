using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaEligibleGoodsReceipts
{
    public class GetSilaEligibleGoodsReceiptsQuery : IRequest<List<SilaEligibleGoodsReceiptDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid PurchaseOrderId { get; set; }
    }
}
