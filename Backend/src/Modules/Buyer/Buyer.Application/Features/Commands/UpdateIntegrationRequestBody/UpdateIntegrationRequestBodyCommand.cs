using MediatR;
using SharedKernel.Integration.Dtos;

namespace Buyer.Application.Features.Commands.UpdateIntegrationRequestBody
{
    /// <summary>
    /// Changes only the request body template (and its payload format) of an integration the application sends to.
    /// The connection is untouched, so the status stays as it is: an active API stays active.
    /// </summary>
    public class UpdateIntegrationRequestBodyCommand : IRequest<IntegrationConfigurationResponseDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid ConfigurationId { get; set; }
        public string? PayloadFormat { get; set; }
        public string? RequestBody { get; set; }
    }
}
