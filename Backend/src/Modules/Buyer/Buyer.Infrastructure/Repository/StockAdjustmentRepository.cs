using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class StockAdjustmentRepository : RepositoryBase<StockAdjustment>, IStockAdjustmentRepository
    {
        public StockAdjustmentRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
