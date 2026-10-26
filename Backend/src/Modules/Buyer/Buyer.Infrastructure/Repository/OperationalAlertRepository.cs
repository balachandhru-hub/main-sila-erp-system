using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class OperationalAlertRepository : RepositoryBase<OperationalAlert>, IOperationalAlertRepository
    {
        public OperationalAlertRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
