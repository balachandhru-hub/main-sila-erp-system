using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.AcceptSilaSubstitution
{
    public class AcceptSilaSubstitutionCommand : IRequest<SilaSubstitutionAcceptResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid ProposalId { get; set; }
        public SilaSubstitutionAcceptDto Request { get; set; } = new();
    }
}
