using Buyer.Domain.Dtos;
using MediatR;
using SharedKernel.Integration.Enums;

namespace Buyer.Application.Features.Queries.ResolveIntegration
{
    /// <summary>
    /// Finds the organization's active API for one API type, before a document is sent to it.
    /// </summary>
    public class ResolveIntegrationQuery : IRequest<IntegrationApiDto>
    {
        public Guid OrganizationId { get; set; }
        public IntegrationProcessType ProcessType { get; set; }
        /// <summary>Preferred entity (company code). The organization-wide configuration is used when it has none of its own.</summary>
        public string? EntityCode { get; set; }
    }
}
