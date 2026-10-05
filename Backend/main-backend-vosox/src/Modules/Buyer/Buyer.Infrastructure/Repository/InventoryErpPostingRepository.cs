using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InventoryErpPostingRepository : RepositoryBase<InventoryErpPosting>, IInventoryErpPostingRepository
    {
        public InventoryErpPostingRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
