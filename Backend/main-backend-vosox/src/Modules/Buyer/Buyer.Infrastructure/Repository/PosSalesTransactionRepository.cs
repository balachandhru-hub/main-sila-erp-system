using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class PosSalesTransactionRepository : RepositoryBase<PosSalesTransaction>, IPosSalesTransactionRepository
    {
        public PosSalesTransactionRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
