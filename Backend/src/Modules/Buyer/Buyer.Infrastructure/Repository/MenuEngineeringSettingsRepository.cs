using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class MenuEngineeringSettingsRepository : RepositoryBase<MenuEngineeringSettings>, IMenuEngineeringSettingsRepository
    {
        public MenuEngineeringSettingsRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
