using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InventoryLocationRepository : RepositoryBase<InventoryLocation>, IInventoryLocationRepository
    {
        public InventoryLocationRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
