using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SaveSilaMenuEngineering
{
    public class SaveSilaMenuEngineeringCommand : IRequest<SilaMenuEngineeringEnvelopeDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaMenuEngineeringSaveDto Request { get; set; } = new();
    }
}
