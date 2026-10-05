using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class RecipeSubstitutionProposalRepository : RepositoryBase<RecipeSubstitutionProposal>, IRecipeSubstitutionProposalRepository
    {
        public RecipeSubstitutionProposalRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
