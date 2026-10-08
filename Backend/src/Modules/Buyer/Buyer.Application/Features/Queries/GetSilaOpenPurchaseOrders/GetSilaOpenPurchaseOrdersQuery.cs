using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaOpenPurchaseOrders
{
    /// <summary>
    /// Purchase orders of the buyer that still have quantity to receive, searched by PO number or supplier.
    /// </summary>
    public class GetSilaOpenPurchaseOrdersQuery : IRequest<List<SilaReceivingPoListItemDto>>
    {
        public Guid OrganizationId { get; set; }
        public string? Search { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
