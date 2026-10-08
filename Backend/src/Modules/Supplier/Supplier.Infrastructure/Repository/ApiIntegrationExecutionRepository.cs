using Supplier.Infrastructure.Contracts.IRepository;
using Supplier.Infrastructure.DbContext;
using SharedKernel.Integration.Entities;

namespace Supplier.Infrastructure.Repository
{
    public class ApiIntegrationExecutionRepository : RepositoryBase<ApiIntegrationExecution>, IApiIntegrationExecutionRepository
    {
        public ApiIntegrationExecutionRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
