using MediatR;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Enums;

namespace Buyer.Application.Features.Queries.GetIntegrationTargetFields
{
    /// <summary>
    /// Lists the fields an API payload can be mapped to: those of this service's API types, or those of one API type.
    /// </summary>
    public class GetIntegrationTargetFieldsQuery : IRequest<List<IntegrationTargetFieldResponseDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public IntegrationProcessType? ProcessType { get; set; }
    }
}
