using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Re-runs a SILA command body when its save lost a race: a document number reserved by a parallel command
    /// (SilaDocumentSequence RowVersion or a unique number index) or a stock balance changed at the same time
    /// (InventoryBalance RowVersion). Each retry clears the change tracker, so the body reloads fresh rows.
    /// User commands answer a stock race with 409 "try again"; system jobs retry it as well.
    /// The body must not call external systems before its single SaveAsync (a retry would repeat the call).
    /// </summary>
    public static class SilaRetry
    {
        public const int MAX_ATTEMPTS = 3;

        private const int SQL_UNIQUE_INDEX = 2601;
        private const int SQL_UNIQUE_CONSTRAINT = 2627;

        /// <summary>User command: number races are retried, a stock race returns 409.</summary>
        public static Task<T> RunAsync<T>(IRepositoryWrapper repository, ILoggerManager logger, string operation, Func<Task<T>> body)
        {
            return RunAsync(repository, logger, operation, false, body);
        }

        /// <summary>System job command: number and stock races are both retried.</summary>
        public static Task<T> RunForJobAsync<T>(IRepositoryWrapper repository, ILoggerManager logger, string operation, Func<Task<T>> body)
        {
            return RunAsync(repository, logger, operation, true, body);
        }

        private static async Task<T> RunAsync<T>(IRepositoryWrapper repository, ILoggerManager logger, string operation, bool retryStock, Func<Task<T>> body)
        {
            for (int attempt = 1; ; attempt++)
            {
                try
                {
                    return await body();
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    bool stock = ex.Entries.Any(x => x.Entity is InventoryBalance);
                    if (stock && !retryStock)
                    {
                        Reset(repository);
                        logger.LogError($"{operation}: stock balance changed by a parallel posting (attempt {attempt}).");
                        throw new ConflictCustomException("Stock changed at the same time, try again",
                            "Another user moved stock of the same material at this location at the same moment. Reload the screen and submit again.");
                    }

                    ThrowWhenExhausted(repository, logger, operation, attempt, stock ? "stock balance" : "document number");
                }
                catch (DbUpdateException ex) when (IsUniqueViolation(ex))
                {
                    ThrowWhenExhausted(repository, logger, operation, attempt, "unique number");
                }
            }
        }

        public static bool IsUniqueViolation(DbUpdateException exception)
        {
            return exception.InnerException is SqlException sql && (sql.Number == SQL_UNIQUE_INDEX || sql.Number == SQL_UNIQUE_CONSTRAINT);
        }

        private static void ThrowWhenExhausted(IRepositoryWrapper repository, ILoggerManager logger, string operation, int attempt, string conflict)
        {
            Reset(repository);
            if (attempt < MAX_ATTEMPTS)
            {
                logger.LogInfo($"{operation}: {conflict} conflict, retrying (attempt {attempt} of {MAX_ATTEMPTS}).");
                return;
            }

            logger.LogError($"{operation}: {conflict} conflict after {MAX_ATTEMPTS} attempts.");
            throw new ConflictCustomException("The document changed at the same time, try again",
                "Other users saved at the same moment several times in a row. Wait a few seconds and submit again.");
        }

        /// <summary>
        /// Drops every pending change of the scoped context (after a failed save inside a per-item loop), so the
        /// next item of the loop does not try to save the failed item's rows again.
        /// </summary>
        public static void DiscardChanges(IRepositoryWrapper repository)
        {
            Reset(repository);
        }

        private static void Reset(IRepositoryWrapper repository)
        {
            repository.SilaDocumentSequence.DetachAllEntities();
            DocumentNumber.Reset(repository);
        }
    }
}
