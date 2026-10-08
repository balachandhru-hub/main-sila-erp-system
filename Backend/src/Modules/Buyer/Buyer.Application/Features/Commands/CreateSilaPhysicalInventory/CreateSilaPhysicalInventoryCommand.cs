using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreateSilaPhysicalInventory
{
    public class CreateSilaPhysicalInventoryCommand : IRequest<SilaPhysicalInventoryDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaPhysicalInventoryWriteDto Request { get; set; } = new SilaPhysicalInventoryWriteDto();
    }
}
