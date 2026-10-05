using Microsoft.EntityFrameworkCore;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;

namespace Buyer.Infrastructure.Repository
{
    public class ApiIntegrationConfigurationRepository : RepositoryBase<ApiIntegrationConfiguration>, IApiIntegrationConfigurationRepository
    {
        public ApiIntegrationConfigurationRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }

        // Atomic claim (one UPDATE ... WHERE is_running = 0): a scheduler and a manual pull,
        // or two instances of the scheduler, can never run the same configuration together.
        public async Task<bool> TryClaimAsync(Guid configurationId, Guid organizationId, CancellationToken cancellationToken)
        {
            DateTime now = DateTime.UtcNow;
            DateTime staleBefore = now.AddMinutes(-30);
            int claimed = await RepositoryContext.ApiIntegrationConfiguration
                .Where(x => x.Id == configurationId && x.OrganizationId == organizationId
                    && (!x.IsRunning || x.RunningSince == null || x.RunningSince < staleBefore)
                    && x.Status != IntegrationConfigurationStatus.INACTIVE)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.IsRunning, true)
                    .SetProperty(x => x.RunningSince, now)
                    .SetProperty(x => x.LastAttemptAt, now)
                    .SetProperty(x => x.DateUpdated, now), cancellationToken);
            return claimed > 0;
        }

        public Task<List<ApiIntegrationConfiguration>> ListDueAsync(DateTime now, int take, List<IntegrationProcessType> processTypes, CancellationToken cancellationToken)
        {
            DateTime staleBefore = now.AddMinutes(-30);
            return RepositoryContext.ApiIntegrationConfiguration
                .AsNoTracking()
                .Where(x => x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.IsActive
                    && processTypes.Contains(x.ProcessType)
                    && x.ScheduleCron != null && x.NextRunAt <= now
                    && (!x.IsRunning || x.RunningSince == null || x.RunningSince < staleBefore))
                .OrderBy(x => x.NextRunAt)
                .Take(take)
                .ToListAsync(cancellationToken);
        }
    }
}
