using Microsoft.EntityFrameworkCore;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;
using SharedKernel.Integration.Entities;

namespace Buyer.Infrastructure.Repository
{
    public class ApiFieldMappingRepository : RepositoryBase<ApiFieldMapping>, IApiFieldMappingRepository
    {
        public ApiFieldMappingRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }

        public Task<List<ApiFieldMapping>> GetTrackedByConfigurationAsync(Guid configurationId, CancellationToken cancellationToken)
        {
            return RepositoryContext.ApiFieldMapping
                .Where(x => x.ConfigurationId == configurationId)
                .ToListAsync(cancellationToken);
        }
    }
}
