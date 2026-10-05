using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaErpPostings
{
    /// <summary>
    /// ERP postings of the buyer's inventory documents, newest first, optionally of one status or reference number.
    /// </summary>
    public class GetSilaErpPostingsQuery : IRequest<List<SilaErpPostingListItemDto>>
    {
        public Guid OrganizationId { get; set; }
        public string? Status { get; set; }
        public string? Search { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
