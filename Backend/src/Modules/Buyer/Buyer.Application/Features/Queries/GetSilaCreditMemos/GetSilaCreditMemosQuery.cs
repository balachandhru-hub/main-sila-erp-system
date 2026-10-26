using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaCreditMemos
{
    /// <summary>
    /// Credit memos of the buyer, newest first. Search by number, invoice, supplier, PO or SAP document.
    /// Status accepts a credit-memo status or IN_PROGRESS, FAILED, POSTED.
    /// </summary>
    public class GetSilaCreditMemosQuery : IRequest<List<SilaCreditMemoListItemDto>>
    {
        public Guid OrganizationId { get; set; }
        public string? Search { get; set; }
        public string? Status { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
