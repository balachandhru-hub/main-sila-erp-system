using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InventoryAlertRepository : RepositoryBase<InventoryAlert>, IInventoryAlertRepository
    {
        public InventoryAlertRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
