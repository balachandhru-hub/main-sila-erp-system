using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.UpdateSilaLocation
{
    public class UpdateSilaLocationCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid LocationId { get; set; }
        public SilaLocationWriteDto Request { get; set; } = new();
    }
}
