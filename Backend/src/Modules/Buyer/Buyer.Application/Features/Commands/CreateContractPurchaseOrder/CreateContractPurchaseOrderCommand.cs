using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreateContractPurchaseOrder
{
    public class CreateContractPurchaseOrderCommand : IRequest<ContractPurchaseOrderDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid ContractId { get; set; }

        /// <summary>The ERP details the user entered. Empty when the buyer has no purchase order API.</summary>
        public CreateContractPurchaseOrderRequestDto Options { get; set; } = new();
    }
}
