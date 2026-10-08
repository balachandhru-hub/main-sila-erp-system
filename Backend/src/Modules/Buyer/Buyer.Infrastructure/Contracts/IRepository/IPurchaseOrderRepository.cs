using Buyer.Domain.Entities;

namespace Buyer.Infrastructure.Contracts.IRepository
{
    public interface IPurchaseOrderRepository : IRepositoryBase<PurchaseOrder>
    {
        /// <summary>
        /// Takes an exclusive database lock on the contract, held until the surrounding transaction ends.
        /// Serializes parallel purchase order creation for one contract. Must run inside a transaction.
        /// </summary>
        Task LockContractAsync(Guid contractId, CancellationToken cancellationToken = default);
    }
}
