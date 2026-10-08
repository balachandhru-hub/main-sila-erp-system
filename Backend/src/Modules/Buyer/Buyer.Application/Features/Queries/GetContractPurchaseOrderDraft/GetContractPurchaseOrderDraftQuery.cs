using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetContractPurchaseOrderDraft
{
    public class GetContractPurchaseOrderDraftQuery : IRequest<ContractPurchaseOrderDraftDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid ContractId { get; set; }
    }
}
