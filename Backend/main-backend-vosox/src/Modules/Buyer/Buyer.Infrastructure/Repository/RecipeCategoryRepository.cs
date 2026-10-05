using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class RecipeCategoryRepository : RepositoryBase<RecipeCategory>, IRecipeCategoryRepository
    {
        public RecipeCategoryRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
