using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;
using SharedKernel.Integration.Entities;

namespace Buyer.Infrastructure.Repository
{
    public class ApiIntegrationExecutionRepository : RepositoryBase<ApiIntegrationExecution>, IApiIntegrationExecutionRepository
    {
        public ApiIntegrationExecutionRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
