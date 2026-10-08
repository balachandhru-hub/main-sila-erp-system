using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class GoodsIssueRepository : RepositoryBase<GoodsIssue>, IGoodsIssueRepository
    {
        public GoodsIssueRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
