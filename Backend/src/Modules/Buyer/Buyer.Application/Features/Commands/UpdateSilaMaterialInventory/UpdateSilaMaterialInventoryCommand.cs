using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.UpdateSilaMaterialInventory
{
    public class UpdateSilaMaterialInventoryCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid MaterialId { get; set; }
        public SilaMaterialInventoryWriteDto Request { get; set; } = new();
    }
}
