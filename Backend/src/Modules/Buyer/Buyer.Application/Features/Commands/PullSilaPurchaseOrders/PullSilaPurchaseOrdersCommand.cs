using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.PullSilaPurchaseOrders
{
    /// <summary>Reads the purchase orders from every active GET_PO API of the organization (source ERP).</summary>
    public class PullSilaPurchaseOrdersCommand : IRequest<SilaMasterPullResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
    }
}
