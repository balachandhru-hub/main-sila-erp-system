using Microsoft.EntityFrameworkCore;
using Supplier.Infrastructure.Contracts.IRepository;
using Supplier.Infrastructure.DbContext;
using SharedKernel.Integration.Entities;

namespace Supplier.Infrastructure.Repository
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
