using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;
using SharedKernel.Integration.Entities;

namespace Buyer.Infrastructure.Repository
{
    public class IntegrationSchemaSnapshotRepository : RepositoryBase<IntegrationSchemaSnapshot>, IIntegrationSchemaSnapshotRepository
    {
        public IntegrationSchemaSnapshotRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
