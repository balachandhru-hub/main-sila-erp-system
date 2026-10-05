using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class GoodsReceiptItemRepository : RepositoryBase<GoodsReceiptItem>, IGoodsReceiptItemRepository
    {
        public GoodsReceiptItemRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
