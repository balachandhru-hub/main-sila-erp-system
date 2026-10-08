using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InventoryLocationUserMappingRepository : RepositoryBase<InventoryLocationUserMapping>, IInventoryLocationUserMappingRepository
    {
        public InventoryLocationUserMappingRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
