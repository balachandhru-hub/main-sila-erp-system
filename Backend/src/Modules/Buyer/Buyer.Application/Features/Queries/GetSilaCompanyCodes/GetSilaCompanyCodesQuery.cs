using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaCompanyCodes
{
    /// <summary>Company Code Master rows of the buyer, searched by code or name.</summary>
    public class GetSilaCompanyCodesQuery : IRequest<List<SilaCompanyCodeDto>>
    {
        public Guid OrganizationId { get; set; }
        public string? Search { get; set; }
        /// <summary>ACTIVE or INACTIVE; empty for both.</summary>
        public string? Status { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
