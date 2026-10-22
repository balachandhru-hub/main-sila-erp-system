using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.AcceptSilaPurchaseRecommendations
{
    public class AcceptSilaPurchaseRecommendationsCommand : IRequest<SilaPurchaseRecommendationAcceptResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaPurchaseRecommendationAcceptWriteDto Request { get; set; } = new();
    }
}
