using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ReprocessPurchaseOrder
{
    /// <summary>
    /// Hands a purchase order to the ERP that did not take it yet: only the hand-offs that are not done are sent again.
    /// </summary>
    public class ReprocessPurchaseOrderCommand : IRequest<PurchaseOrderProcessResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid PurchaseOrderId { get; set; }
    }
}
