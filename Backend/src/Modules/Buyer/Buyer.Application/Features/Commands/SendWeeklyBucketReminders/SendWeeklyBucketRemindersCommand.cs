using MediatR;

namespace Buyer.Application.Features.Commands.SendWeeklyBucketReminders
{
    /// <summary>
    /// One reminder pass for one buyer: emails the store managers about every weekly bucket that is still open once the
    /// reminder period of the bucket's week has started. Returns the number of emails sent.
    /// </summary>
    public class SendWeeklyBucketRemindersCommand : IRequest<int>
    {
        public Guid BuyerId { get; set; }
    }
}
