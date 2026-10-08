using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InventoryWorkflowEventRepository : RepositoryBase<InventoryWorkflowEvent>, IInventoryWorkflowEventRepository
    {
        public InventoryWorkflowEventRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
