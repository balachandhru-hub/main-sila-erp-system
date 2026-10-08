using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InventoryTransactionRepository : RepositoryBase<InventoryTransaction>, IInventoryTransactionRepository
    {
        public InventoryTransactionRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
