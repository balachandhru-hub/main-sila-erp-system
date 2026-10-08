using Buyer.Domain.Entities;

namespace Buyer.Infrastructure.Contracts.IRepository
{
    public interface IPurchaseDocumentIntegrationRepository : IRepositoryBase<PurchaseDocumentIntegration>
    {
        /// <summary>
        /// Marks the hand-off as PROCESSING in one atomic update, unless another request already has it in progress
        /// (a PROCESSING row last attempted after <paramref name="staleBefore"/>). True when this request now owns it.
        /// </summary>
        Task<bool> TryClaimAsync(Guid id, DateTime staleBefore, CancellationToken cancellationToken = default);
    }
}
