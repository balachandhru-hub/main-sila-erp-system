using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.PostPendingErpPostings
{
    /// <summary>
    /// Sends the oldest PENDING inventory documents of all buyers to their ERP (at most 50 per run): goods receipts through
    /// the POST_GRN API, supplier invoices through POST_INVOICE (after their goods receipts), every other document through
    /// the POST_GOODS_MOVEMENT API. The API is chosen by the document's company code, falling back to the ALL API. A call
    /// without a clear answer leaves the posting UNKNOWN until a user reconciles it. Sent by the InventoryErpPostingJob.
    /// </summary>
    public class PostPendingErpPostingsCommand : IRequest<SilaErpPostingRunResultDto>
    {
        public int BatchSize { get; set; } = 50;

        /// <summary>Only this buyer (BuyerBusinessProfile id) when set; the scheduler runs one buyer per scope.</summary>
        public Guid? BuyerId { get; set; }
    }
}
