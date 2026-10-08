using SharedKernel.Integration.Entities;

namespace Buyer.Infrastructure.Contracts.IRepository
{
    public interface IApiFieldMappingRepository : IRepositoryBase<ApiFieldMapping>
    {
        Task<List<ApiFieldMapping>> GetTrackedByConfigurationAsync(Guid configurationId, CancellationToken cancellationToken);
    }
}
