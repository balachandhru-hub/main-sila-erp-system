using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class CreditMemoItemRepository : RepositoryBase<CreditMemoItem>, ICreditMemoItemRepository
    {
        public CreditMemoItemRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
