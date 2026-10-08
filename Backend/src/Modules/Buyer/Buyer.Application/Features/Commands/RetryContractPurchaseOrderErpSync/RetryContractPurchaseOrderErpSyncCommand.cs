using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.RetryContractPurchaseOrderErpSync
{
    public class RetryContractPurchaseOrderErpSyncCommand : IRequest<ContractPurchaseOrderDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid PurchaseOrderId { get; set; }
    }
}
