using MediatR;

namespace Buyer.Application.Features.Commands.ReprocessSilaErpPosting
{
    /// <summary>
    /// Queues a FAILED or SKIPPED ERP posting again: it goes back to PENDING with no attempts, and the next job run sends it.
    /// </summary>
    public class ReprocessSilaErpPostingCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid PostingId { get; set; }
    }
}
