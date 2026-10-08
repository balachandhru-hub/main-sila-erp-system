using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class PosOutletMappingRepository : RepositoryBase<PosOutletMapping>, IPosOutletMappingRepository
    {
        public PosOutletMappingRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
