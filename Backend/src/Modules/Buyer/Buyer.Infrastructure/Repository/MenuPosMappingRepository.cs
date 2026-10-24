using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class MenuPosMappingRepository : RepositoryBase<MenuPosMapping>, IMenuPosMappingRepository
    {
        public MenuPosMappingRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
