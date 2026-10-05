using Supplier.Infrastructure.Contracts.IRepository;
using Supplier.Infrastructure.DbContext;
using SharedKernel.Integration.Entities;

namespace Supplier.Infrastructure.Repository
{
    public class IntegrationSchemaSnapshotRepository : RepositoryBase<IntegrationSchemaSnapshot>, IIntegrationSchemaSnapshotRepository
    {
        public IntegrationSchemaSnapshotRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
