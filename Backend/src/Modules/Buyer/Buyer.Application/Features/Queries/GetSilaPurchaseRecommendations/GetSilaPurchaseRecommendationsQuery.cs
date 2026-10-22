using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPurchaseRecommendations
{
    public class GetSilaPurchaseRecommendationsQuery : IRequest<SilaPurchaseRecommendationListDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid? PropertyId { get; set; }
        public Guid? LocationId { get; set; }
    }
}
