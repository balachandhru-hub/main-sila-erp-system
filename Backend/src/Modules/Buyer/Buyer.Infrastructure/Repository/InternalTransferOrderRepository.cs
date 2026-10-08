using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InternalTransferOrderRepository : RepositoryBase<InternalTransferOrder>, IInternalTransferOrderRepository
    {
        public InternalTransferOrderRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
