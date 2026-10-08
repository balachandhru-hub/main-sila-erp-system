using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class StockShortageEnquiryRepository : RepositoryBase<StockShortageEnquiry>, IStockShortageEnquiryRepository
    {
        public StockShortageEnquiryRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
