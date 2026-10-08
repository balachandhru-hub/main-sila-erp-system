using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.DismissSilaSubstitution
{
    public class DismissSilaSubstitutionCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid ProposalId { get; set; }
        public SilaSubstitutionDismissDto Request { get; set; } = new();
    }
}
