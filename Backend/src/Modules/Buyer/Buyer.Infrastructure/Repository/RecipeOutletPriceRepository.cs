using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class RecipeOutletPriceRepository : RepositoryBase<RecipeOutletPrice>, IRecipeOutletPriceRepository
    {
        public RecipeOutletPriceRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
