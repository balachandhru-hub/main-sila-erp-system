using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class MenuPlanRepository : RepositoryBase<MenuPlan>, IMenuPlanRepository
    {
        public MenuPlanRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
