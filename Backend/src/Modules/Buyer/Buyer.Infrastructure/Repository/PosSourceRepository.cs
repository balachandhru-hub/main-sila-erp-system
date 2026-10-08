using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class PosSourceRepository : RepositoryBase<PosSource>, IPosSourceRepository
    {
        public PosSourceRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
