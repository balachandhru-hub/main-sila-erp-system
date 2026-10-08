using MediatR;

namespace Buyer.Application.Features.Commands.RunWeeklyBucketAutomation
{
    /// <summary>
    /// One scheduler pass for one buyer: creates the purchase orders of every approved weekly bucket whose weekend (the
    /// bucket's own week) has started. Returns the number of buckets sent for purchase order creation.
    /// </summary>
    public class RunWeeklyBucketAutomationCommand : IRequest<int>
    {
        public Guid BuyerId { get; set; }
    }
}
