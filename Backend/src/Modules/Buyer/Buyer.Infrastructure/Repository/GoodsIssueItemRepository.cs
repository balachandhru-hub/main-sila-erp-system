using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class GoodsIssueItemRepository : RepositoryBase<GoodsIssueItem>, IGoodsIssueItemRepository
    {
        public GoodsIssueItemRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
