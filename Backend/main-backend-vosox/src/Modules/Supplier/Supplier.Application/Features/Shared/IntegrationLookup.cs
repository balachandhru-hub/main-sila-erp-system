using Microsoft.EntityFrameworkCore;
using Supplier.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Supplier.Application.Features.Shared
{
    /// <summary>
    /// The lookups every integration use case of this service starts with.
    /// </summary>
    public static class IntegrationLookup
    {
        /// <summary>The organization's configuration, tracked. Not found is a 404.</summary>
        public static async Task<ApiIntegrationConfiguration> GetTrackedAsync(IRepositoryWrapper repository, ILoggerManager logger, Guid configurationId, Guid organizationId)
        {
            ApiIntegrationConfiguration? configuration = await repository.ApiIntegrationConfiguration.FindFirstByConditionAsync(
                x => x.Id == configurationId && x.OrganizationId == organizationId && x.IsActive);
            if (configuration == null)
            {
                logger.LogError($"Integration configuration not found. ConfigurationId: {configurationId}, OrganizationId: {organizationId}");
                throw new NotFoundCustomException("Integration not found.", "The integration configuration does not exist in your organization.");
            }

            return configuration;
        }

        /// <summary>Whether the organization already has another API of this type: it has one API per API type.</summary>
        public static Task<bool> HasOtherOfTypeAsync(IRepositoryWrapper repository, ApiIntegrationConfiguration configuration, IntegrationProcessType processType, CancellationToken cancellationToken)
        {
            return repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.Id != configuration.Id && x.OrganizationId == configuration.OrganizationId && x.ProcessType == processType)
                .AnyAsync(cancellationToken);
        }
    }
}
