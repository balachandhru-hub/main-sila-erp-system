using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InternalTransferOrderItemRepository : RepositoryBase<InternalTransferOrderItem>, IInternalTransferOrderItemRepository
    {
        public InternalTransferOrderItemRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
