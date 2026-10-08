using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class PhysicalInventoryRequestRepository : RepositoryBase<PhysicalInventoryRequest>, IPhysicalInventoryRequestRepository
    {
        public PhysicalInventoryRequestRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
