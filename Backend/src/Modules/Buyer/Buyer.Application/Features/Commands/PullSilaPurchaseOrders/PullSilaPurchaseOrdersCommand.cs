using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.PullSilaPurchaseOrders
{
    /// <summary>
    /// Reads purchase orders from active GET_PO APIs. With company code and date range, uses FIVE S4 - GET PO (or the
    /// company / ALL match) and writes only when <see cref="Request"/>.Commit is true.
    /// </summary>
    public class PullSilaPurchaseOrdersCommand : IRequest<SilaMasterPullResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        /// <summary>Null = legacy full pull of every active GET_PO (always committed).</summary>
        public SilaPurchaseOrderPullWriteDto? Request { get; set; }
    }
}
