using Buyer.Domain.Entities;

namespace Buyer.Infrastructure.Contracts.IRepository
{
    public interface ICreditMemoRepository : IRepositoryBase<CreditMemo>
    {
        /// <summary>True when this instance is already tracked as a new row that has not been inserted.</summary>
        bool IsAdded(CreditMemo memo);
    }
}
