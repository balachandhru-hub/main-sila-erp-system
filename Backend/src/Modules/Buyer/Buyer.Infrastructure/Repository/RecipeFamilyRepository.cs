using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class RecipeFamilyRepository : RepositoryBase<RecipeFamily>, IRecipeFamilyRepository
    {
        public RecipeFamilyRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
