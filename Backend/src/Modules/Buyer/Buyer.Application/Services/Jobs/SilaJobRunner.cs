using Buyer.Application.Features.Shared;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services.Jobs
{
    /// <summary>
    /// Runs a scheduler job one item (buyer, organization or integration) at a time, each in its own DI scope with its own
    /// IMediator and DbContext: a failed save or a dirty context of one item never leaks into the next, and a failure is
    /// logged (id + short message) and counted while the others continue.
    /// </summary>
    public static class SilaJobRunner
    {
        /// <summary>Returns the number of items that failed; collect receives the result of every item that succeeded.</summary>
        public static async Task<int> ForEachAsync<TResult>(
            IServiceScopeFactory scopeFactory,
            ILoggerManager logger,
            string jobName,
            string itemLabel,
            IReadOnlyList<Guid> itemIds,
            Func<IMediator, Guid, CancellationToken, Task<TResult>> work,
            Action<TResult> collect,
            CancellationToken cancellationToken)
        {
            int failed = 0;
            foreach (Guid itemId in itemIds)
            {
                cancellationToken.ThrowIfCancellationRequested();
                try
                {
                    using IServiceScope scope = scopeFactory.CreateScope();
                    IMediator mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                    TResult result = await work(mediator, itemId, cancellationToken);
                    collect(result);
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    // Nothing of this item is kept in the next item's scope; the next run tries it again.
                    failed++;
                    logger.LogError($"[{jobName}] {itemLabel} failed. {itemLabel}Id: {itemId}, Error: {SilaLogText.Short(exception.Message)}");
                }
            }

            return failed;
        }
    }
}
