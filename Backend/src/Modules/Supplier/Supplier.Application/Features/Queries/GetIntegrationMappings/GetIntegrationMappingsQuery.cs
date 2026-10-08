using MediatR;
using SharedKernel.Integration.Dtos;

namespace Supplier.Application.Features.Queries.GetIntegrationMappings
{
    /// <summary>
    /// Lists the field mappings of an integration configuration.
    /// </summary>
    public class GetIntegrationMappingsQuery : IRequest<List<IntegrationMappingResponseDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid ConfigurationId { get; set; }
    }
}
