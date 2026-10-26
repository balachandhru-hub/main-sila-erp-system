using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class MenuPlanLineRepository : RepositoryBase<MenuPlanLine>, IMenuPlanLineRepository
    {
        public MenuPlanLineRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
