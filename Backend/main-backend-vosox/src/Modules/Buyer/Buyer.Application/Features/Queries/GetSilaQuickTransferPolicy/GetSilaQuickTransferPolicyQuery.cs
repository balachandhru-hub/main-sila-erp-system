using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaQuickTransferPolicy
{
    public class GetSilaQuickTransferPolicyQuery : IRequest<SilaQuickTransferPolicyDto>
    {
        public Guid OrganizationId { get; set; }
    }
}
