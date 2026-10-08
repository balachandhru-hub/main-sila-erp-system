using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class LocationMaterialThresholdRepository : RepositoryBase<LocationMaterialThreshold>, ILocationMaterialThresholdRepository
    {
        public LocationMaterialThresholdRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
