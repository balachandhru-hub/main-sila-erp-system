using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class SilaSupplierRepository : RepositoryBase<SilaSupplier>, ISilaSupplierRepository
    {
        public SilaSupplierRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
