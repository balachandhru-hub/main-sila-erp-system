using System.Transactions;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Makes a command that composes other use cases (each with its own SaveAsync) all-or-nothing: every save inside
    /// the body joins one ambient database transaction, committed only when the whole body succeeded.
    /// The scoped DbContext uses one connection at a time, so the transaction stays local (no distributed transaction).
    /// </summary>
    public static class SilaTransaction
    {
        public static async Task<T> RunAsync<T>(Func<Task<T>> body)
        {
            TransactionOptions options = new TransactionOptions
            {
                IsolationLevel = IsolationLevel.ReadCommitted,
                Timeout = TimeSpan.FromMinutes(1)
            };
            using TransactionScope scope = new TransactionScope(TransactionScopeOption.Required, options, TransactionScopeAsyncFlowOption.Enabled);
            T result = await body();
            scope.Complete();
            return result;
        }
    }
}
