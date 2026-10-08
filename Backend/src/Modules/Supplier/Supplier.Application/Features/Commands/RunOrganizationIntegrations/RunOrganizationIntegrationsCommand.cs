using MediatR;
using SharedKernel.Integration.Enums;
using Supplier.Domain.Dto;

namespace Supplier.Application.Features.Commands.RunOrganizationIntegrations
{
    /// <summary>
    /// Runs the active APIs of one type of several supplier organizations now, for example the product
    /// stock APIs of the suppliers a buyer is about to order from.
    /// </summary>
    public class RunOrganizationIntegrationsCommand : IRequest<RunOrganizationIntegrationsResultDto>
    {
        public List<Guid> OrganizationIds { get; set; } = new();
        public IntegrationProcessType ProcessType { get; set; }
    }
}
