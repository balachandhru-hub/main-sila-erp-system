using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaRecipeMasters
{
    /// <summary>Active recipe families or categories of the buyer.</summary>
    public class GetSilaRecipeMastersQuery : IRequest<List<SilaRecipeMasterDto>>
    {
        public Guid OrganizationId { get; set; }
        /// <summary>families | categories</summary>
        public string Kind { get; set; } = string.Empty;
        /// <summary>Code or name.</summary>
        public string? Search { get; set; }
        /// <summary>ACTIVE (default), INACTIVE or ALL.</summary>
        public string? Status { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 200;
    }
}
