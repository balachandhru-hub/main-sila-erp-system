using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;

namespace Buyer.Infrastructure.Contracts.IRepository
{
    public interface IApiIntegrationConfigurationRepository : IRepositoryBase<ApiIntegrationConfiguration>
    {
        /// <summary>Marks the configuration as running, unless it already runs or is inactive. True when this caller claimed it.</summary>
        Task<bool> TryClaimAsync(Guid configurationId, Guid organizationId, CancellationToken cancellationToken);

        /// <summary>Active, scheduled configurations of the given API types whose next run is due.</summary>
        Task<List<ApiIntegrationConfiguration>> ListDueAsync(DateTime now, int take, List<IntegrationProcessType> processTypes, CancellationToken cancellationToken);
    }
}
