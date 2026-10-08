using MediatR;

namespace Buyer.Application.Features.Commands.QuickCreateWeeklyBucketPurchaseOrders
{
    /// <summary>
    /// Creates the purchase orders of an approved weekly bucket now, without waiting for the weekend.
    /// </summary>
    public class QuickCreateWeeklyBucketPurchaseOrdersCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid WeeklyBucketId { get; set; }
    }
}
