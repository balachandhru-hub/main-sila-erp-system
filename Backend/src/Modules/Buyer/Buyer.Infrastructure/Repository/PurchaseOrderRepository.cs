using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Infrastructure.Repository
{
    public class PurchaseOrderRepository : RepositoryBase<PurchaseOrder>, IPurchaseOrderRepository
    {
        public PurchaseOrderRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }

        public async Task LockContractAsync(Guid contractId, CancellationToken cancellationToken = default)
        {
            string resource = $"contract-purchase-order:{contractId}";
            await RepositoryContext.Database.ExecuteSqlInterpolatedAsync(
                $@"DECLARE @result int;
                   EXEC @result = sp_getapplock @Resource = {resource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
                   IF @result < 0 THROW 51000, 'The contract is busy. Try again.', 1;",
                cancellationToken);
        }
    }
}
