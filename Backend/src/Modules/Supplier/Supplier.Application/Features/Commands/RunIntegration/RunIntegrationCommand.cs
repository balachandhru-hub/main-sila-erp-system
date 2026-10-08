using MediatR;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Enums;

namespace Supplier.Application.Features.Commands.RunIntegration
{
    /// <summary>
    /// Pulls the supplier's product catalog or product stock API and writes the records into the supplier's catalog. Also sent by the integration scheduler worker.
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
