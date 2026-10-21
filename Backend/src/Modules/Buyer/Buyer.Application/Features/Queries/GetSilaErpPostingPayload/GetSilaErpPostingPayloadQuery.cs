using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaErpPostingPayload
{
    /// <summary>The JSON sent for one ERP posting, for the transaction tracker.</summary>
    public class GetSilaErpPostingPayloadQuery : IRequest<SilaErpPostingPayloadDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid PostingId { get; set; }
    }
}
