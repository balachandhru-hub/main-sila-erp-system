using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaMenuEngineering
{
    public class GetSilaMenuEngineeringQuery : IRequest<SilaMenuEngineeringEnvelopeDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public string View { get; set; } = "dashboard";
        public SilaMenuEngineeringFilterDto Filter { get; set; } = new();
        public SilaMenuWhatIfRequestDto? Simulation { get; set; }
    }
}
