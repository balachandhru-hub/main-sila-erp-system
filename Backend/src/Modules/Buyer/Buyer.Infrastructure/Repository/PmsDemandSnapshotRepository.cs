using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class PmsDemandSnapshotRepository : RepositoryBase<PmsDemandSnapshot>, IPmsDemandSnapshotRepository
    {
        public PmsDemandSnapshotRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
