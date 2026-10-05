using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class SilaApprovalStepRepository : RepositoryBase<SilaApprovalStep>, ISilaApprovalStepRepository
    {
        public SilaApprovalStepRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
