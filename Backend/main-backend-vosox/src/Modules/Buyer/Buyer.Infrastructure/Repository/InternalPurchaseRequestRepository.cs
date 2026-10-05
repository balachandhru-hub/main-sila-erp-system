using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InternalPurchaseRequestRepository : RepositoryBase<InternalPurchaseRequest>, IInternalPurchaseRequestRepository
    {
        public InternalPurchaseRequestRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
