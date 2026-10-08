using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.RescheduleSilaPhysicalInventory
{
    public class RescheduleSilaPhysicalInventoryCommand : IRequest<SilaPhysicalInventoryDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid RequestId { get; set; }
        public SilaPhysicalInventoryScheduleDto Request { get; set; } = new SilaPhysicalInventoryScheduleDto();
    }
}
