using MediatR;
using SharedKernel.Integration.Dtos;

namespace Supplier.Application.Features.Queries.GetIntegrationTargetFields
{
    /// <summary>
    /// Lists the fields an API payload can be mapped to: those of this service's API types, or those of one API type.
    /// </summary>
    public class GetIntegrationTargetFieldsQuery : IRequest<List<IntegrationTargetFieldResponseDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public string? ProcessType { get; set; }
    }
}
