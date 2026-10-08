using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InventoryLocationMaterialRepository : RepositoryBase<InventoryLocationMaterial>, IInventoryLocationMaterialRepository
    {
        public InventoryLocationMaterialRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
