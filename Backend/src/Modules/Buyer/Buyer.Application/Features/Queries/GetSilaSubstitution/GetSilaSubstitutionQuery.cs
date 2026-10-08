using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaSubstitution
{
    public class GetSilaSubstitutionQuery : IRequest<SilaSubstitutionDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid ProposalId { get; set; }
    }
}
