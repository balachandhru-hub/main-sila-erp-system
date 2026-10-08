using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SyncContractErp
{
    public class SyncContractErpCommand : IRequest<ContractErpSyncDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid ContractId { get; set; }
    }
}
