using Microsoft.EntityFrameworkCore;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
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

        /// <summary>
        /// Whether the organization already has another API of this type for the entity code: it has one API per API type
        /// and entity code (ALL, or a company code, so SAP and Ariba can serve different company codes).
        /// </summary>
        public static Task<bool> HasOtherOfTypeAsync(IRepositoryWrapper repository, ApiIntegrationConfiguration configuration, IntegrationProcessType processType, string? entityCode, CancellationToken cancellationToken)
        {
            string code = (entityCode ?? string.Empty).Trim();
            return repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.Id != configuration.Id && x.OrganizationId == configuration.OrganizationId && x.ProcessType == processType && x.EntityCode == code)
                .AnyAsync(cancellationToken);
        }

        /// <summary>
        /// Refuses an entity code that is neither ALL nor a company code of the buyer (Company Code Master or a property).
        /// The code the configuration already has is always accepted.
        /// </summary>
        public static async Task EnsureEntityCodeAsync(IRepositoryWrapper repository, ILoggerManager logger, Guid organizationId, string? entityCode, string? currentEntityCode, CancellationToken cancellationToken)
        {
            string code = (entityCode ?? string.Empty).Trim();
            if (code.Length == 0
                || code.Equals(IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase)
                || code.Equals(currentEntityCode?.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            Guid? buyerId = await repository.BuyerBusinessProfile
                .FindByCondition(x => x.OrganizationId == organizationId && x.IsActive)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);
            bool known = buyerId != null
                && (await repository.CompanyCodeMaster.FindByCondition(x => x.BuyerId == buyerId.Value && x.IsActive && x.Code == code).AnyAsync(cancellationToken)
                    || await repository.BuyerProperty.FindByCondition(x => x.BuyerId == buyerId.Value && x.IsActive && x.CompanyCode == code).AnyAsync(cancellationToken));
            if (!known)
            {
                logger.LogError($"Integration entity code is not a company code. EntityCode: {code}, OrganizationId: {organizationId}");
                throw new BadRequestCustomException("Unknown entity code.", $"Use ALL or a company code of your organization; {code} is not in the Company Code Master.");
            }
        }
    }
}
