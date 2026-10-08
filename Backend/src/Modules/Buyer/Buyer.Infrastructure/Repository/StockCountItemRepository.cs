using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class StockCountItemRepository : RepositoryBase<StockCountItem>, IStockCountItemRepository
    {
        public StockCountItemRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
