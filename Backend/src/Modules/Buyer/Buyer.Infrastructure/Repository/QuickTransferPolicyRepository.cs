using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class QuickTransferPolicyRepository : RepositoryBase<QuickTransferPolicy>, IQuickTransferPolicyRepository
    {
        public QuickTransferPolicyRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
