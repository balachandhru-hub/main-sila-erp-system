using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class PosItemMappingRepository : RepositoryBase<PosItemMapping>, IPosItemMappingRepository
    {
        public PosItemMappingRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
