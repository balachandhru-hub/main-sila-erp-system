using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class StockCountPhotoRepository : RepositoryBase<StockCountPhoto>, IStockCountPhotoRepository
    {
        public StockCountPhotoRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
