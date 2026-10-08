using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.GenerateSilaSubstitutionProposals
{
    /// <summary>
    /// Runs the recipe substitution check: for one buyer (OrganizationId set, manual run) or for every buyer with approved
    /// recipes (OrganizationId null, scheduler).
    /// </summary>
    public class GenerateSilaSubstitutionProposalsCommand : IRequest<SilaSubstitutionRunResultDto>
    {
        public Guid? OrganizationId { get; set; }
        public Guid UserId { get; set; }

        /// <summary>Only this buyer (BuyerBusinessProfile id) when set; the scheduler runs one buyer per scope.</summary>
        public Guid? BuyerId { get; set; }
    }
}
