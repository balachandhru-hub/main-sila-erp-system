using MediatR;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Enums;

namespace Buyer.Application.Features.Commands.RunIntegration
{
    /// <summary>
    /// Pulls the buyer's stock API to check it and its mapping (stock in hand itself is read live when it is needed). Also sent by the integration scheduler worker.
    /// </summary>
    public class RunIntegrationCommand : IRequest<IntegrationExecutionResponseDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid ConfigurationId { get; set; }
        public IntegrationExecutionTrigger Trigger { get; set; } = IntegrationExecutionTrigger.MANUAL;
        public bool FullSync { get; set; }
    }
}
