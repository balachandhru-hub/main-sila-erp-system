using MediatR;
using SharedKernel.Integration.Dtos;

namespace Buyer.Application.Features.Queries.GetDueIntegrations
{
    /// <summary>
    /// Sent by the integration scheduler worker: the active, scheduled pulls that are due.
    /// </summary>
    public class GetDueIntegrationsQuery : IRequest<List<DueIntegrationDto>>
    {
    }
}
