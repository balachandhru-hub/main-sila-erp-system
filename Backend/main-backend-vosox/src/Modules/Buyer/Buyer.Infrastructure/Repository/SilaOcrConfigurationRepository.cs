using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class SilaOcrConfigurationRepository : RepositoryBase<SilaOcrConfiguration>, ISilaOcrConfigurationRepository
    {
        public SilaOcrConfigurationRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
