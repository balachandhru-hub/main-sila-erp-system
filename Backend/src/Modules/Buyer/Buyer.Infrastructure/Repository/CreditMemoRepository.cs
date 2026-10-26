using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Infrastructure.Repository
{
    public class CreditMemoRepository : RepositoryBase<CreditMemo>, ICreditMemoRepository
    {
        public CreditMemoRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }

        public bool IsAdded(CreditMemo memo)
        {
            return RepositoryContext.Entry(memo).State == EntityState.Added;
        }
    }
}
