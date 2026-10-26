using MediatR;

namespace Buyer.Application.Features.Commands.DeleteIntegration
{
    /// <summary>Removes an integration and its mappings, schema and run history.</summary>
    public class DeleteIntegrationCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid ConfigurationId { get; set; }
    }
}
