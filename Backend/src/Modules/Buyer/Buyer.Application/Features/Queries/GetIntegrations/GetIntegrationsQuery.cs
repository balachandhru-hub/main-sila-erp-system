using MediatR;
using SharedKernel.Integration.Dtos;

namespace Buyer.Application.Features.Queries.GetIntegrations
{
    /// <summary>
    /// Lists the integration configurations of the organization.
    /// </summary>
    public class GetIntegrationsQuery : IRequest<List<IntegrationConfigurationResponseDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
    }
}
