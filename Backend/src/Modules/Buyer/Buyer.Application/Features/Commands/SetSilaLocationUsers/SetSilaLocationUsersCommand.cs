using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SetSilaLocationUsers
{
    public class SetSilaLocationUsersCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid LocationId { get; set; }
        public SilaLocationUsersWriteDto Request { get; set; } = new();
    }
}
