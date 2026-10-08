using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Infrastructure.Repository
{
    public class PurchaseDocumentIntegrationRepository : RepositoryBase<PurchaseDocumentIntegration>, IPurchaseDocumentIntegrationRepository
    {
        public PurchaseDocumentIntegrationRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }

        public async Task<bool> TryClaimAsync(Guid id, DateTime staleBefore, CancellationToken cancellationToken = default)
        {
            DateTime now = DateTime.UtcNow;
            int claimed = await RepositoryContext.Set<PurchaseDocumentIntegration>()
                .Where(x => x.Id == id
                    && (x.Status != Common.INTEGRATION_PROCESSING || x.LastAttemptOn == null || x.LastAttemptOn < staleBefore))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.Status, Common.INTEGRATION_PROCESSING)
                    .SetProperty(x => x.LastAttemptOn, now), cancellationToken);
            return claimed == 1;
        }
    }
}
