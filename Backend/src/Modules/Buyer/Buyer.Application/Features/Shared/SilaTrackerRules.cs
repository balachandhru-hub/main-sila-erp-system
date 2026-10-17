using Buyer.Domain.Common;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Read-model rules for the two transaction trackers. Stages are derived from the records that already
    /// exist. A confirmed ERP reference is never treated as a reason to call SAP again.
    /// </summary>
    public static class SilaTrackerRules
    {
        public const string TRACKER_PURCHASING = "PURCHASING";
        public const string TRACKER_SILA_ME = "SILA_ME";

        public const string SOURCE_ERP = "ERP";
        public const string SOURCE_POS = "POS";
        public const string SOURCE_PO = "PO";
        public const string SOURCE_RUN = "RUN";

        public const string NOT_STARTED = "NOT_STARTED";
        public const string PROCESSING = "PROCESSING";
        public const string SUCCESS = "SUCCESS";
        public const string FAILED = "FAILED";
        public const string UNKNOWN = "UNKNOWN";

        public const string OVERALL_SUCCESS = "SUCCESS";
        public const string OVERALL_FAILED = "FAILED";
        public const string OVERALL_FAILED_LOCAL = "FAILED_LOCAL";
        public const string OVERALL_UNKNOWN = "POSTING_UNKNOWN";
        public const string OVERALL_PROCESSING = "PROCESSING";
        public const string OVERALL_REPROCESSING = "REPROCESSING";
        public const string OVERALL_PARTIAL = "PARTIAL";
        public const string OVERALL_RECEIVED = "RECEIVED";

        public const string ACTION_REPROCESS = "REPROCESS";
        public const string ACTION_RECONCILE = "RECONCILE";
        public const string ACTION_NONE = "NONE";

        public const string FROM_RECEIVE = "RECEIVE";
        public const string FROM_ERP = "ERP";
        public const string FROM_LOCAL = "LOCAL";

        public const string DIRECTION_INBOUND = "INBOUND";
        public const string DIRECTION_OUTBOUND = "OUTBOUND";
        public const string DATA_MASTER = "MASTER_DATA";
        public const string DATA_TRANSACTION = "TRANSACTION_DATA";

        public const string EVENT_REPROCESS = "TRACKER_REPROCESS";

        public static readonly string[] PurchasingProcessTypes =
        {
            "GET_SUPPLIER", "POST_SUPPLIER", "GET_MATERIAL", "GET_PO", "GET_CONTRACT", "POST_CONTRACT",
            "GET_CATALOG", "GET_CATALOG_STOCK", "GET_STOCK", "EXTRACT_INVOICE", "POST_PO"
        };

        public static readonly string[] SilaMeProcessTypes = { "GET_POS_SALE" };

        public readonly record struct Stages(
            string Receive,
            string Erp,
            string Local,
            string Overall,
            string Action,
            string? ReprocessFrom,
            bool ErpCallAllowed);

        public static string Key(string source, Guid id) => source + "~" + id.ToString("D");

        public static bool TryParseKey(string? key, out string source, out Guid id)
        {
            source = string.Empty;
            id = Guid.Empty;
            if (string.IsNullOrWhiteSpace(key))
            {
                return false;
            }

            int split = key.IndexOf('~');
            if (split <= 0 || split == key.Length - 1 || !Guid.TryParse(key[(split + 1)..], out id))
            {
                return false;
            }

            source = key[..split].Trim().ToUpperInvariant();
            return source is SOURCE_ERP or SOURCE_POS or SOURCE_PO or SOURCE_RUN;
        }

        public static bool ErpAlreadyAccepted(InventoryErpPosting posting)
        {
            return posting.Status == Common.SILA_POSTING_ERP_ACCEPTED
                || posting.Status == Common.SILA_POSTING_FAILED_LOCAL
                || !string.IsNullOrWhiteSpace(posting.ErpReference);
        }

        public static Stages OfPosting(string status, int attempts, string? erpReference)
        {
            bool accepted = !string.IsNullOrWhiteSpace(erpReference)
                || status == Common.SILA_POSTING_ERP_ACCEPTED
                || status == Common.SILA_POSTING_FAILED_LOCAL
                || status == Common.SILA_POSTING_POSTED;
            string receive = SUCCESS;
            string erp;
            string local;
            if (status == Common.SILA_POSTING_UNKNOWN)
            {
                erp = UNKNOWN;
                local = NOT_STARTED;
            }
            else if (status == Common.SILA_POSTING_POSTED)
            {
                erp = SUCCESS;
                local = SUCCESS;
            }
            else if (status == Common.SILA_POSTING_FAILED_LOCAL || (accepted && status != Common.SILA_POSTING_FAILED && status != Common.SILA_POSTING_SKIPPED))
            {
                erp = SUCCESS;
                local = status == Common.SILA_POSTING_FAILED_LOCAL ? FAILED : NOT_STARTED;
            }
            else if (accepted && (status == Common.SILA_POSTING_FAILED || status == Common.SILA_POSTING_SKIPPED))
            {
                erp = SUCCESS;
                local = FAILED;
            }
            else if (status == Common.SILA_POSTING_FAILED || status == Common.SILA_POSTING_SKIPPED)
            {
                erp = FAILED;
                local = NOT_STARTED;
            }
            else if (attempts > 0)
            {
                erp = PROCESSING;
                local = NOT_STARTED;
            }
            else
            {
                erp = NOT_STARTED;
                local = NOT_STARTED;
            }

            bool waiting = status == Common.SILA_POSTING_PENDING;
            return Finish(receive, erp, local, attempts > 0 && waiting, waiting);
        }

        public static Stages OfPos(string status, string? failedStep, Stages? posting)
        {
            string receive = SUCCESS;
            if (status == Common.SILA_POS_POSTED)
            {
                return Finish(receive, SUCCESS, SUCCESS, false, false);
            }

            if (status == Common.SILA_POS_FAILED && failedStep != Common.SILA_POS_STEP_POST)
            {
                return Finish(receive, NOT_STARTED, FAILED, false, false);
            }

            if (posting != null)
            {
                Stages erp = posting.Value;
                string local = erp.Erp == SUCCESS && erp.Local == FAILED
                    ? FAILED
                    : status is Common.SILA_POS_INVENTORY_DEDUCTED or Common.SILA_POS_FAILED ? SUCCESS : erp.Local;
                return Finish(receive, erp.Erp, local, erp.Overall == OVERALL_REPROCESSING, erp.Action == ACTION_NONE && erp.Erp is PROCESSING or NOT_STARTED);
            }

            if (status == Common.SILA_POS_INVENTORY_DEDUCTED)
            {
                return Finish(receive, NOT_STARTED, SUCCESS, false, false);
            }

            return Finish(receive, NOT_STARTED, NOT_STARTED, false, false);
        }

        public static Stages OfPurchase(string status, bool outcomeUnknown, string? externalNumber, int retryCount)
        {
            bool number = !string.IsNullOrWhiteSpace(externalNumber);
            string receive = SUCCESS;
            if (outcomeUnknown || status == Common.INTEGRATION_UNKNOWN)
            {
                return Finish(receive, UNKNOWN, NOT_STARTED, false, false);
            }

            if (status == Common.INTEGRATION_SUCCEEDED)
            {
                return Finish(receive, SUCCESS, SUCCESS, false, false);
            }

            if (number)
            {
                return Finish(receive, SUCCESS, FAILED, false, false);
            }

            if (status == Common.INTEGRATION_FAILED)
            {
                return Finish(receive, FAILED, NOT_STARTED, false, false);
            }

            bool pending = retryCount > 0 || status == Common.PURCHASE_ORDER_ERP_PENDING || status == "PENDING";
            if (pending)
            {
                return Finish(receive, PROCESSING, NOT_STARTED, retryCount > 0, true);
            }

            return Finish(receive, NOT_STARTED, NOT_STARTED, false, true);
        }

        public static Stages OfRun(string status, int recordsRead, int recordsFailed, string trigger)
        {
            if (string.Equals(trigger, "TEST", StringComparison.OrdinalIgnoreCase))
            {
                string testedErp = status == "FAILED" ? FAILED : status == "RUNNING" ? PROCESSING : SUCCESS;
                Stages tested = Finish(SUCCESS, testedErp, status == "SUCCESS" ? SUCCESS : NOT_STARTED, false, true);
                return tested with { Action = ACTION_NONE, ReprocessFrom = null, ErpCallAllowed = false };
            }

            if (status == "RUNNING")
            {
                return Finish(SUCCESS, PROCESSING, NOT_STARTED, false, true);
            }

            if (status == "FAILED" && recordsRead == 0)
            {
                return Finish(SUCCESS, FAILED, NOT_STARTED, false, false);
            }

            if (status == "FAILED" || status == "PARTIAL" || recordsFailed > 0)
            {
                Stages partial = Finish(SUCCESS, SUCCESS, FAILED, false, false);
                return partial with { Overall = OVERALL_PARTIAL, Action = ACTION_NONE, ReprocessFrom = null, ErpCallAllowed = false };
            }

            return Finish(SUCCESS, SUCCESS, SUCCESS, false, false);
        }

        public static string DirectionOfProcess(string? processType)
        {
            return (processType ?? string.Empty).StartsWith("GET_", StringComparison.OrdinalIgnoreCase)
                ? DIRECTION_INBOUND
                : DIRECTION_OUTBOUND;
        }

        public static string DataClassOfProcess(string? processType)
        {
            return processType is "GET_SUPPLIER" or "POST_SUPPLIER" or "GET_MATERIAL" or "GET_CATALOG" or "GET_CATALOG_STOCK" or "GET_STOCK"
                ? DATA_MASTER
                : DATA_TRANSACTION;
        }

        public static string TransactionTypeOfPosting(string referenceType, string movementType)
        {
            if (referenceType == Common.SILA_REF_ITO && movementType == "301")
            {
                return "PLANT_TRANSFER_301";
            }

            if (referenceType == Common.SILA_REF_ITO)
            {
                return "INTERNAL_TRANSFER_311";
            }

            if (referenceType == Common.SILA_REF_STOCK_COUNT && movementType == "Z01")
            {
                return "PHYSICAL_COUNT_SURPLUS";
            }

            if (referenceType == Common.SILA_REF_STOCK_COUNT && movementType == "Z02")
            {
                return "PHYSICAL_COUNT_SHORTAGE";
            }

            if (referenceType == Common.SILA_REF_ADJUSTMENT && movementType == "Z01")
            {
                return "POSITIVE_STOCK_ADJUSTMENT";
            }

            if (referenceType == Common.SILA_REF_ADJUSTMENT && movementType == "Z02")
            {
                return "NEGATIVE_STOCK_ADJUSTMENT";
            }

            if (referenceType == Common.SILA_REF_POS_SALE && movementType == "Z01")
            {
                return "POS_POSITIVE_CORRECTION";
            }

            if (referenceType == Common.SILA_REF_POS_SALE)
            {
                return "POS_SALE";
            }

            return string.IsNullOrWhiteSpace(referenceType) ? movementType : referenceType;
        }

        public static string LocalFailureMessage(string? erpReference)
        {
            string number = string.IsNullOrWhiteSpace(erpReference) ? "the ERP document" : erpReference.Trim();
            return "LOCAL FINALIZATION FAILED. SAP document " + number
                + " was created, but SILA failed while updating the local transaction. Reprocessing resumes from local finalization and will not call SAP again.";
        }

        private static Stages Finish(string receive, string erp, string local, bool reprocessing, bool waitingForJob)
        {
            string overall;
            if (erp == UNKNOWN)
            {
                overall = OVERALL_UNKNOWN;
            }
            else if (local == FAILED && erp == SUCCESS)
            {
                overall = OVERALL_FAILED_LOCAL;
            }
            else if (receive == FAILED || erp == FAILED || local == FAILED)
            {
                overall = OVERALL_FAILED;
            }
            else if (receive == SUCCESS && erp == SUCCESS && local == SUCCESS)
            {
                overall = OVERALL_SUCCESS;
            }
            else if (reprocessing)
            {
                overall = OVERALL_REPROCESSING;
            }
            else if (receive == SUCCESS && erp == NOT_STARTED && local == NOT_STARTED)
            {
                overall = OVERALL_RECEIVED;
            }
            else
            {
                overall = OVERALL_PROCESSING;
            }

            if (erp == UNKNOWN)
            {
                return new Stages(receive, erp, local, overall, ACTION_RECONCILE, null, false);
            }

            if (overall == OVERALL_SUCCESS || waitingForJob)
            {
                return new Stages(receive, erp, local, overall, ACTION_NONE, null, false);
            }

            if (erp == SUCCESS && local != SUCCESS)
            {
                return new Stages(receive, erp, local, overall, ACTION_REPROCESS, FROM_LOCAL, false);
            }

            if (erp == FAILED)
            {
                return new Stages(receive, erp, local, overall, ACTION_REPROCESS, FROM_ERP, true);
            }

            if (local == FAILED)
            {
                return new Stages(receive, erp, local, overall, ACTION_REPROCESS, FROM_LOCAL, false);
            }

            if (erp == NOT_STARTED)
            {
                return new Stages(receive, erp, local, overall, ACTION_REPROCESS, FROM_RECEIVE, false);
            }

            return new Stages(receive, erp, local, overall, ACTION_NONE, null, false);
        }
    }
}
