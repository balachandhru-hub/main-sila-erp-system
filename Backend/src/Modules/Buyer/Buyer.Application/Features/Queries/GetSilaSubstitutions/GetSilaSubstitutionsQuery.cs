using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaSubstitutions
{
    public class GetSilaSubstitutionsQuery : IRequest<SilaSubstitutionPageDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        /// <summary>PROPOSED | ACCEPTED | DISMISSED; all when empty.</summary>
        public string? Status { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 50;
    }
}
