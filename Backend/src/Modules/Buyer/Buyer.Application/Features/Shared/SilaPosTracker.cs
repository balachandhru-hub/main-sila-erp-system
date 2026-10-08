using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The tracker view of a POS sale: its three steps (received, inventory deducted, posted to the ERP). A deducted sale shows
    /// POSTED or FAILED once the InventoryErpPostingJob has posted it or failed.
    /// </summary>
    public static class SilaPosTracker
    {
        private const string STEP_DONE = "DONE";
        private const string STEP_FAILED = "FAILED";
        private const string STEP_PENDING = "PENDING";
        private const string STEP_SKIPPED = "SKIPPED";
        private const string STEP_UNKNOWN = "UNKNOWN";

        public const string FAILURE_MATCH = "MATCH_FAILED";
        public const string FAILURE_DEDUCT = "DEDUCT_FAILED";
        public const string FAILURE_ERP = "ERP_FAILED";
        public const string FAILURE_ERP_UNKNOWN = "ERP_UNKNOWN";

        public static SilaPosTransactionDto ToDto(
            PosSalesTransaction transaction, InventoryErpPosting? posting, string? locationName, Recipe? recipe, string? batchNumber, string? locationType = null)
        {
            SilaPosTransactionDto dto = ToStepDto(transaction, posting, locationName, recipe, batchNumber);
            dto.RecipeVersion = transaction.RecipeVersion;
            dto.MenuItem = recipe == null ? null : recipe.PosItem ?? recipe.Name;
            dto.LocationType = locationType;
            dto.ErpHttpStatus = posting?.ErpHttpStatus;
            dto.IntegrationSystem = posting?.IntegrationSystem;
            dto.MovementType = posting?.MovementType;
            dto.Step1Status = dto.DeductState;
            dto.Step1Message = dto.DeductState == STEP_FAILED
                ? dto.FailureMessage
                : dto.DeductState == STEP_DONE ? "Inventory deducted for the recipe's ingredients." : "Waiting to be matched and deducted.";
            dto.Step2Status = dto.PostState;
            dto.Step2Message = dto.PostState switch
            {
                STEP_DONE => posting?.ErpReference == null ? "Posted to the ERP." : $"Posted to the ERP: document {posting.ErpReference}.",
                STEP_FAILED => dto.FailureMessage,
                STEP_SKIPPED or STEP_UNKNOWN => dto.FailureMessage,
                _ => dto.DeductState == STEP_DONE ? "Queued for the ERP posting." : "Waits for step 1."
            };
            dto.FailureCode = dto.DeductState == STEP_FAILED
                ? (transaction.FailedStep == Common.SILA_POS_STEP_MATCH ? FAILURE_MATCH : FAILURE_DEDUCT)
                : dto.PostState == STEP_FAILED ? FAILURE_ERP : dto.PostState == STEP_UNKNOWN ? FAILURE_ERP_UNKNOWN : null;
            return dto;
        }

        /// <summary>Step and status of a timeline event action, e.g. DEDUCT_FAILED = (DEDUCT, FAILED).</summary>
        public static (string? Step, string? Status) EventStep(string action)
        {
            return action switch
            {
                Common.SILA_POS_RECEIVED => ("RECEIVE", STEP_DONE),
                "MATCHED" => ("MATCH", STEP_DONE),
                "MATCH_FAILED" => ("MATCH", STEP_FAILED),
                "INVENTORY_DEDUCTED" => ("DEDUCT", STEP_DONE),
                "DEDUCT_FAILED" => ("DEDUCT", STEP_FAILED),
                "ERP_POSTING_QUEUED" or "ERP_POSTING_REQUEUED" => ("POST", "QUEUED"),
                "ERP_POSTED" => ("POST", STEP_DONE),
                "ERP_FAILED" => ("POST", STEP_FAILED),
                "ERP_SKIPPED" => ("POST", STEP_SKIPPED),
                "ERP_UNKNOWN" => ("POST", STEP_UNKNOWN),
                "REPROCESS_REQUESTED" => ("REPROCESS", "REQUESTED"),
                _ => (null, null)
            };
        }

        private static SilaPosTransactionDto ToStepDto(PosSalesTransaction transaction, InventoryErpPosting? posting, string? locationName, Recipe? recipe, string? batchNumber)
        {
            SilaPosTransactionDto dto = new SilaPosTransactionDto
            {
                Id = transaction.Id,
                BatchId = transaction.BatchId,
                BatchNumber = batchNumber,
                SourceTransactionId = transaction.SourceTransactionId,
                LineNumber = transaction.LineNumber,
                BusinessDate = transaction.BusinessDate,
                OutletCode = transaction.OutletCode,
                OutletLocationId = transaction.OutletLocationId,
                OutletLocationName = locationName,
                PosCode = transaction.PosCode,
                RecipeId = transaction.RecipeId,
                RecipeCode = recipe?.RecipeCode,
                RecipeName = recipe?.Name,
                QuantitySold = transaction.QuantitySold,
                Amount = transaction.Amount,
                Uom = transaction.Uom,
                Currency = transaction.Currency,
                Status = transaction.Status,
                FailedStep = transaction.FailedStep,
                FailureMessage = transaction.FailureMessage,
                ReceivedState = STEP_DONE,
                DeductState = STEP_PENDING,
                PostState = STEP_PENDING,
                ErpPostingId = transaction.ErpPostingId,
                ErpPostingStatus = posting?.Status,
                ErpReference = posting?.ErpReference,
                PostedOn = posting?.PostedOn,
                DateCreated = transaction.DateCreated
            };

            if (transaction.Status == Common.SILA_POS_FAILED)
            {
                // MATCH and DEDUCT are both part of the inventory step.
                if (transaction.FailedStep == Common.SILA_POS_STEP_POST)
                {
                    dto.DeductState = STEP_DONE;
                    dto.PostState = STEP_FAILED;
                }
                else
                {
                    dto.DeductState = STEP_FAILED;
                }

                dto.CanReprocess = true;
            }
            else if (transaction.Status == Common.SILA_POS_POSTED)
            {
                dto.DeductState = STEP_DONE;
                dto.PostState = STEP_DONE;
            }
            else if (transaction.Status == Common.SILA_POS_INVENTORY_DEDUCTED)
            {
                dto.DeductState = STEP_DONE;
                if (posting?.Status == Common.SILA_POSTING_POSTED)
                {
                    dto.Status = Common.SILA_POS_POSTED;
                    dto.PostState = STEP_DONE;
                }
                else if (posting?.Status == Common.SILA_POSTING_FAILED)
                {
                    dto.Status = Common.SILA_POS_FAILED;
                    dto.FailedStep = Common.SILA_POS_STEP_POST;
                    dto.FailureMessage = posting.ErrorMessage ?? "The ERP did not accept the consumption posting.";
                    dto.PostState = STEP_FAILED;
                    dto.CanReprocess = true;
                }
                else if (posting?.Status == Common.SILA_POSTING_SKIPPED)
                {
                    dto.PostState = STEP_SKIPPED;
                    dto.FailureMessage = posting.ErrorMessage;
                }
                else if (posting?.Status == Common.SILA_POSTING_UNKNOWN)
                {
                    // Timed out: the ERP may have posted it. The posting is reconciled under ERP postings before any retry.
                    dto.PostState = STEP_UNKNOWN;
                    dto.FailureMessage = posting.ErrorMessage ?? "The ERP did not answer in time. Reconcile the posting under ERP postings.";
                }
            }

            return dto;
        }
    }
}
