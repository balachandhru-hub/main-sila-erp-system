using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>The batch and the lines stored by <see cref="SilaPosProcessing.ReceiveAsync"/>.</summary>
    public class SilaPosReceipt
    {
        public PosSalesBatch Batch { get; set; } = null!;
        public List<PosSalesTransaction> Transactions { get; set; } = new();
        /// <summary>The stored line of each accepted file row / API record.</summary>
        public Dictionary<int, PosSalesTransaction> ByRow { get; set; } = new();
        public HashSet<int> DuplicateRows { get; set; } = new();
    }

    /// <summary>
    /// The POS sales pipeline shared by the upload (preview, then process), the POS API pull (one step) and the reprocess:
    /// step 0 receive (rows → batch + RECEIVED lines, duplicates skipped), step MATCH (<see cref="SilaPosMatching"/>),
    /// step DEDUCT (RECIPE_CONSUMPTION per ingredient of the approved version, batches expanded) and step POST (ERP posting
    /// queued for the InventoryErpPostingJob). Each step writes a POS_SALE workflow event (the transaction timeline). A failing
    /// step marks the line FAILED with the step and the reason; nothing throws. The calling command saves once.
    /// </summary>
    public static class SilaPosProcessing
    {
        public const string EVENT_MATCHED = "MATCHED";
        public const string EVENT_MATCH_FAILED = "MATCH_FAILED";
        public const string EVENT_DEDUCTED = "INVENTORY_DEDUCTED";
        public const string EVENT_DEDUCT_FAILED = "DEDUCT_FAILED";
        public const string EVENT_POSTING_QUEUED = "ERP_POSTING_QUEUED";
        public const string EVENT_REPROCESS = "REPROCESS_REQUESTED";
        public const string EVENT_POSTING_REQUEUED = "ERP_POSTING_REQUEUED";

        private const int MAX_RECIPE_DEPTH = 10;

        /// <summary>
        /// Step 0: creates the batch and one RECEIVED line per new row. A row already received (same transaction id and line,
        /// in this file or before) is a duplicate and skipped — except a line still waiting in an unprocessed PREVIEW batch,
        /// which moves to this batch (re-uploading a corrected file replaces the abandoned preview).
        /// </summary>
        public static async Task<SilaPosReceipt> ReceiveAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            Guid userId,
            string source,
            Guid? posSourceId,
            string? fileName,
            string batchStatus,
            List<SilaPosSaleRowDto> rows,
            int totalRows,
            int invalidRows,
            CancellationToken cancellationToken)
        {
            PosSalesBatch batch = new PosSalesBatch
            {
                Id = Guid.NewGuid(),
                BuyerId = buyerId,
                BatchNumber = await DocumentNumber.NextAsync(repository, buyerId, DocumentNumber.POS_BATCH, 6, cancellationToken),
                Source = source,
                PosSourceId = posSourceId,
                FileName = fileName,
                UploadedBy = userId,
                Status = batchStatus,
                Rows = totalRows,
                Invalid = invalidRows,
                BusinessDateFrom = rows.Count == 0 ? null : rows.Min(x => x.BusinessDate),
                BusinessDateTo = rows.Count == 0 ? null : rows.Max(x => x.BusinessDate),
                IsActive = true
            };

            List<string> transactionIds = rows.Select(x => x.TransactionId).Distinct().ToList();
            List<PosSalesTransaction> known = transactionIds.Count == 0
                ? new List<PosSalesTransaction>()
                : await repository.PosSalesTransaction
                    .FindByCondition(x => x.BuyerId == buyerId && transactionIds.Contains(x.SourceTransactionId))
                    .ToListAsync(cancellationToken);
            List<Guid> waitingBatchIds = known.Where(x => x.Status == Common.SILA_POS_RECEIVED && x.BatchId != null).Select(x => x.BatchId!.Value).Distinct().ToList();
            HashSet<Guid> previewBatchIds = waitingBatchIds.Count == 0
                ? new HashSet<Guid>()
                : (await repository.PosSalesBatch
                    .FindByCondition(x => waitingBatchIds.Contains(x.Id) && x.Status == Common.SILA_POS_BATCH_PREVIEW)
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken)).ToHashSet();
            Dictionary<string, PosSalesTransaction> knownByKey = known
                .GroupBy(x => Key(x.SourceTransactionId, x.LineNumber), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

            SilaPosReceipt receipt = new SilaPosReceipt { Batch = batch };
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (SilaPosSaleRowDto row in rows)
            {
                string key = Key(row.TransactionId, row.LineId);
                if (!seen.Add(key))
                {
                    receipt.DuplicateRows.Add(row.RowNumber);
                    continue;
                }

                PosSalesTransaction? transaction = null;
                if (knownByKey.TryGetValue(key, out PosSalesTransaction? existing))
                {
                    bool waiting = existing.Status == Common.SILA_POS_RECEIVED && existing.BatchId != null && previewBatchIds.Contains(existing.BatchId.Value);
                    if (!waiting)
                    {
                        receipt.DuplicateRows.Add(row.RowNumber);
                        continue;
                    }

                    transaction = existing;
                    repository.PosSalesTransaction.Update(transaction);
                }
                else
                {
                    transaction = new PosSalesTransaction
                    {
                        Id = Guid.NewGuid(),
                        BuyerId = buyerId,
                        SourceTransactionId = row.TransactionId,
                        LineNumber = row.LineId,
                        IsActive = true
                    };
                    repository.PosSalesTransaction.Create(transaction);
                }

                transaction.BatchId = batch.Id;
                transaction.BusinessDate = row.BusinessDate;
                transaction.OutletCode = row.OutletCode;
                transaction.PosCode = row.PosCode;
                transaction.QuantitySold = row.Quantity;
                transaction.Amount = row.Amount;
                transaction.Uom = row.Uom;
                transaction.Currency = row.Currency;
                transaction.Status = Common.SILA_POS_RECEIVED;
                transaction.OutletLocationId = null;
                transaction.RecipeId = null;
                transaction.FailedStep = null;
                transaction.FailureMessage = null;
                receipt.Transactions.Add(transaction);
                receipt.ByRow[row.RowNumber] = transaction;
            }

            batch.Accepted = receipt.Transactions.Count;
            batch.Duplicates = receipt.DuplicateRows.Count;
            repository.PosSalesBatch.Create(batch);
            return receipt;
        }

        /// <summary>
        /// Runs each line from where it stands (RECEIVED, FAILED, or deducted without a queued posting) to INVENTORY_DEDUCTED with a
        /// queued ERP posting. A line failed at MATCH or DEDUCT starts again at MATCH (no stock was moved for it). The lines must be
        /// tracked. Returns the number that failed.
        /// </summary>
        public static async Task<int> ProcessAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            Guid userId,
            List<PosSalesTransaction> transactions,
            CancellationToken cancellationToken)
        {
            if (transactions.Count == 0)
            {
                return 0;
            }

            List<Guid> batchIds = transactions.Where(x => x.BatchId != null).Select(x => x.BatchId!.Value).Distinct().ToList();
            Dictionary<Guid, Guid?> sourceByBatch = batchIds.Count == 0
                ? new Dictionary<Guid, Guid?>()
                : await repository.PosSalesBatch
                    .FindByCondition(x => batchIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, x => x.PosSourceId, cancellationToken);
            List<Guid> sourceIds = sourceByBatch.Values.Where(x => x != null).Select(x => x!.Value).Distinct().ToList();
            SilaPosMatching context = await SilaPosMatching.LoadAsync(repository, buyerId, sourceIds, cancellationToken);
            InventoryLedger ledger = new InventoryLedger(repository, buyerId, userId);

            int failed = 0;
            foreach (PosSalesTransaction transaction in transactions)
            {
                string? step = StartStep(transaction);
                if (step == null)
                {
                    continue;
                }

                if (step == Common.SILA_POS_STEP_MATCH)
                {
                    Guid? sourceId = transaction.BatchId != null && sourceByBatch.TryGetValue(transaction.BatchId.Value, out Guid? found) ? found : null;
                    SilaPosMatch match = context.Match(sourceId, transaction.OutletCode, transaction.PosCode, transaction.Uom);
                    transaction.OutletLocationId = match.Outlet?.Id;
                    transaction.RecipeId = match.Recipe?.Id;
                    transaction.RecipeVersion = match.Recipe?.ActiveVersion;
                    if (match.Status != SilaPosMatching.ROW_READY)
                    {
                        Fail(ledger, transaction, Common.SILA_POS_STEP_MATCH, EVENT_MATCH_FAILED, match.Message ?? "The sale cannot be matched.");
                        failed++;
                        continue;
                    }

                    ledger.AddEvent(
                        Common.SILA_REF_POS_SALE,
                        transaction.Id,
                        EVENT_MATCHED,
                        $"Outlet {match.Outlet!.LocationCode}, recipe {match.Recipe!.RecipeCode} version {match.Recipe.ActiveVersion}.");

                    string? problem = await DeductAsync(context, ledger, transaction, cancellationToken);
                    if (problem != null)
                    {
                        Fail(ledger, transaction, Common.SILA_POS_STEP_DEDUCT, EVENT_DEDUCT_FAILED, problem);
                        failed++;
                        continue;
                    }
                }

                InventoryErpPosting posting = ledger.QueueErpPosting(
                    Common.SILA_REF_POS_SALE,
                    transaction.Id,
                    transaction.SourceTransactionId,
                    transaction.OutletLocationId,
                    Common.SILA_MOVEMENT_CONSUMPTION);
                transaction.ErpPostingId = posting.Id;
                transaction.Status = Common.SILA_POS_INVENTORY_DEDUCTED;
                transaction.FailedStep = null;
                transaction.FailureMessage = null;
                ledger.AddEvent(Common.SILA_REF_POS_SALE, transaction.Id, EVENT_POSTING_QUEUED, "Consumption queued for the ERP posting.");
            }

            await UpdateLastSaleDatesAsync(repository, buyerId, transactions, cancellationToken);
            logger.LogInfo($"POS transactions processed. BuyerId: {buyerId}, Count: {transactions.Count}, Failed: {failed}");
            return failed;
        }

        /// <summary>
        /// Recipe.LastSaleDate becomes the latest business date of the sales consumed in this run (never moved back). The caller
        /// saves.
        /// </summary>
        private static async Task UpdateLastSaleDatesAsync(
            IRepositoryWrapper repository, Guid buyerId, List<PosSalesTransaction> transactions, CancellationToken cancellationToken)
        {
            Dictionary<Guid, DateTime> latest = transactions
                .Where(x => x.RecipeId != null && x.Status == Common.SILA_POS_INVENTORY_DEDUCTED)
                .GroupBy(x => x.RecipeId!.Value)
                .ToDictionary(x => x.Key, x => x.Max(y => y.BusinessDate).Date);
            if (latest.Count == 0)
            {
                return;
            }

            List<Guid> ids = latest.Keys.ToList();
            List<Recipe> recipes = await repository.Recipe
                .FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                .ToListAsync(cancellationToken);
            foreach (Recipe recipe in recipes.Where(x => x.LastSaleDate == null || x.LastSaleDate < latest[x.Id]))
            {
                recipe.LastSaleDate = latest[recipe.Id];
                repository.Recipe.Update(recipe);
            }
        }

        private static string? StartStep(PosSalesTransaction transaction)
        {
            if (transaction.Status == Common.SILA_POS_RECEIVED)
            {
                return Common.SILA_POS_STEP_MATCH;
            }

            if (transaction.Status == Common.SILA_POS_FAILED)
            {
                // Nothing was deducted for a line failed at MATCH or DEDUCT, so it is matched again with today's master data.
                return transaction.FailedStep == Common.SILA_POS_STEP_POST ? Common.SILA_POS_STEP_POST : Common.SILA_POS_STEP_MATCH;
            }

            // Deducted but the posting was never queued.
            if (transaction.Status == Common.SILA_POS_INVENTORY_DEDUCTED && transaction.ErpPostingId == null)
            {
                return Common.SILA_POS_STEP_POST;
            }

            return null;
        }

        /// <summary>Posts RECIPE_CONSUMPTION per material; validates everything first so a failing sale posts nothing. Returns the problem or null.</summary>
        private static async Task<string?> DeductAsync(SilaPosMatching context, InventoryLedger ledger, PosSalesTransaction transaction, CancellationToken cancellationToken)
        {
            if (transaction.RecipeId == null || transaction.OutletLocationId == null)
            {
                return "The sale is not matched to a recipe and an outlet.";
            }

            Dictionary<Guid, decimal> quantities = new Dictionary<Guid, decimal>();
            string? problem = Expand(context, transaction.RecipeId.Value, transaction.QuantitySold, quantities, 0);
            if (problem != null)
            {
                return problem;
            }

            foreach (Guid materialId in quantities.Keys)
            {
                if (!context.Materials.TryGetValue(materialId, out ItemBuyerMaster? material) || !material.IsActive)
                {
                    return "An ingredient material is no longer active in the Item Master. Correct the recipe.";
                }
            }

            int lines = 0;
            foreach (KeyValuePair<Guid, decimal> entry in quantities.Where(x => x.Value > 0))
            {
                await ledger.PostAsync(new InventoryMovement
                {
                    LocationId = transaction.OutletLocationId.Value,
                    Material = context.Materials[entry.Key],
                    Direction = Common.SILA_DIRECTION_OUT,
                    TransactionType = Common.SILA_TXN_RECIPE_CONSUMPTION,
                    BaseQuantity = entry.Value,
                    EnteredQuantity = entry.Value,
                    ReferenceType = Common.SILA_REF_POS_SALE,
                    ReferenceId = transaction.Id,
                    ReferenceNumber = transaction.SourceTransactionId,
                    Reason = $"POS {transaction.PosCode} x {transaction.QuantitySold:0.####}",
                    BusinessDate = transaction.BusinessDate
                }, cancellationToken);
                lines++;
            }

            ledger.AddEvent(Common.SILA_REF_POS_SALE, transaction.Id, EVENT_DEDUCTED, $"{lines} ingredient consumption line{(lines == 1 ? string.Empty : "s")} posted.");
            return null;
        }

        /// <summary>Adds the base quantity of every material of the recipe's approved version × factor; a batch is expanded per serving.</summary>
        private static string? Expand(SilaPosMatching context, Guid recipeId, decimal factor, Dictionary<Guid, decimal> quantities, int depth)
        {
            if (depth > MAX_RECIPE_DEPTH)
            {
                return "Batch recipes are nested too deeply. Check the sub-recipes.";
            }

            Recipe? recipe = context.SellableRecipe(recipeId);
            if (recipe == null)
            {
                return "A recipe or sub-recipe of this sale has no approved version any more. Approve it, then reprocess.";
            }

            List<RecipeIngredient> ingredients = context.Ingredients.TryGetValue(recipeId, out List<RecipeIngredient>? found) ? found : new List<RecipeIngredient>();
            if (ingredients.Count == 0)
            {
                return $"Recipe {recipe.RecipeCode} version {recipe.ActiveVersion} has no ingredients.";
            }

            foreach (RecipeIngredient ingredient in ingredients)
            {
                if (ingredient.MaterialId != null)
                {
                    quantities[ingredient.MaterialId.Value] = quantities.GetValueOrDefault(ingredient.MaterialId.Value) + ingredient.BaseQuantity * factor;
                    continue;
                }

                Recipe? sub = ingredient.SubRecipeId == null ? null : context.SellableRecipe(ingredient.SubRecipeId.Value);
                if (sub == null || sub.ServingQty <= 0)
                {
                    return $"Sub-recipe {ingredient.ItemCode} of {recipe.RecipeCode} has no approved version. Approve it, then reprocess.";
                }

                string? problem = Expand(context, sub.Id, factor * ingredient.BaseQuantity / sub.ServingQty, quantities, depth + 1);
                if (problem != null)
                {
                    return problem;
                }
            }

            return null;
        }

        private static void Fail(InventoryLedger ledger, PosSalesTransaction transaction, string step, string eventAction, string message)
        {
            transaction.Status = Common.SILA_POS_FAILED;
            transaction.FailedStep = step;
            transaction.FailureMessage = message;
            ledger.AddEvent(Common.SILA_REF_POS_SALE, transaction.Id, eventAction, message);
        }

        private static string Key(string transactionId, int lineNumber)
        {
            return $"{transactionId.Trim()}#{lineNumber}";
        }
    }
}
