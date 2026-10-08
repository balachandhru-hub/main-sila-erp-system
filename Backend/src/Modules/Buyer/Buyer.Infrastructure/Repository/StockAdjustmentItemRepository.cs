using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class StockAdjustmentItemRepository : RepositoryBase<StockAdjustmentItem>, IStockAdjustmentItemRepository
    {
        public StockAdjustmentItemRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
