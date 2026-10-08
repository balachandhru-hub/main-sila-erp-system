using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetContractPurchaseOrders
{
    public class GetContractPurchaseOrdersQuery : IRequest<List<ContractPurchaseOrderDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid ContractId { get; set; }
    }
}
