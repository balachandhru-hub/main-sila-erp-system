using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class OperationalTaskRepository : RepositoryBase<OperationalTask>, IOperationalTaskRepository
    {
        public OperationalTaskRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
