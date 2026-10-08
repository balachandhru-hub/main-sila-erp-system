using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class MaterialOutletPriceRepository : RepositoryBase<MaterialOutletPrice>, IMaterialOutletPriceRepository
    {
        public MaterialOutletPriceRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
