using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class StockCountRepository : RepositoryBase<StockCount>, IStockCountRepository
    {
        public StockCountRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
