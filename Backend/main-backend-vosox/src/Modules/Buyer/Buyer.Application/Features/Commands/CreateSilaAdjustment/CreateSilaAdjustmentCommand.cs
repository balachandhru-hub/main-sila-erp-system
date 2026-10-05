using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreateSilaAdjustment
{
    public class CreateSilaAdjustmentCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaAdjustmentWriteDto Request { get; set; } = new();
    }
}
