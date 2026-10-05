using SharedKernel.Integration.Entities;

namespace Supplier.Infrastructure.Contracts.IRepository
{
    public interface IApiFieldMappingRepository : IRepositoryBase<ApiFieldMapping>
    {
        Task<List<ApiFieldMapping>> GetTrackedByConfigurationAsync(Guid configurationId, CancellationToken cancellationToken);
    }
}
