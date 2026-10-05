using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class GoodsReceiptRepository : RepositoryBase<GoodsReceipt>, IGoodsReceiptRepository
    {
        public GoodsReceiptRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
