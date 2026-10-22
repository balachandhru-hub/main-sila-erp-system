using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class CreditMemoRepository : RepositoryBase<CreditMemo>, ICreditMemoRepository
    {
        public CreditMemoRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
