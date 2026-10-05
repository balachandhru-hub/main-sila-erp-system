using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CancelSilaPhysicalInventory
{
    public class CancelSilaPhysicalInventoryCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid RequestId { get; set; }
        public SilaPhysicalInventoryCancelDto Request { get; set; } = new SilaPhysicalInventoryCancelDto();
    }
}
