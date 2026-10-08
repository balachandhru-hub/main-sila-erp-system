using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SetSilaLocationMaterials
{
    public class SetSilaLocationMaterialsCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid LocationId { get; set; }
        public SilaLocationMaterialsWriteDto Request { get; set; } = new();
    }
}
