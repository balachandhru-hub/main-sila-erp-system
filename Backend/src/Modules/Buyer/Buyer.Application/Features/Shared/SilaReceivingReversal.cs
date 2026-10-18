using Buyer.Domain.Common;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Decides whether a goods-receipt reversal (SAP Cancel → 102) may start.
    /// A posted supplier invoice blocks until that invoice is reversed first.
    /// </summary>
    public static class SilaReceivingReversal
    {
        public const string NOT_POSTED = "NOT_POSTED";
        public const string INVOICE_FIRST = "INVOICE_REVERSAL_REQUIRED";
        public const string NOT_CONFIGURED = "NOT CONFIGURED";
        public const string READY = "READY";
        public const string ALREADY_REVERSED = "ALREADY_REVERSED";
        public const string IN_FLIGHT = "IN_FLIGHT";
        public const string UNKNOWN = "POSTING_UNKNOWN";
        public const string MISSING_MATERIAL_DOCUMENT = "MISSING_MATERIAL_DOCUMENT";
        /// <summary>SAP Cancel succeeded; local inventory/finalization must be completed without calling Cancel again.</summary>
        public const string LOCAL_FINALIZE = "LOCAL_FINALIZE";

        public static string InvoiceGate(string? invoiceStatus)
        {
            if (string.IsNullOrWhiteSpace(invoiceStatus))
            {
                return "NO_INVOICE";
            }

            return invoiceStatus.Trim().ToUpperInvariant() switch
            {
                Common.SILA_INVOICE_POSTED => "INVOICE_POSTED",
                Common.SILA_INVOICE_AWAITING_PAYMENT => "INVOICE_POSTED",
                Common.SILA_INVOICE_PAID => "INVOICE_POSTED",
                Common.SILA_INVOICE_PARTIALLY_PAID => "INVOICE_POSTED",
                Common.SILA_INVOICE_POSTING => "INVOICE_POSTING",
                Common.SILA_INVOICE_POSTING_FAILED => "INVOICE_POSTING_FAILED",
                Common.SILA_INVOICE_POSTING_UNKNOWN => "INVOICE_REVERSAL_UNKNOWN",
                Common.SILA_INVOICE_READY => "INVOICE_READY",
                Common.SILA_INVOICE_READY_TO_POST => "INVOICE_READY",
                Common.SILA_INVOICE_GRN_IN_PROGRESS => "INVOICE_DRAFT",
                Common.SILA_INVOICE_GRN_POSTED => "INVOICE_DRAFT",
                Common.SILA_INVOICE_REVIEWED => "INVOICE_DRAFT",
                Common.SILA_INVOICE_EXTRACTED => "INVOICE_DRAFT",
                Common.SILA_INVOICE_UPLOADED => "INVOICE_DRAFT",
                _ when invoiceStatus.Contains("REVERS", StringComparison.OrdinalIgnoreCase)
                    && invoiceStatus.Contains("FAIL", StringComparison.OrdinalIgnoreCase) => "INVOICE_REVERSAL_FAILED",
                _ when invoiceStatus.Contains("REVERS", StringComparison.OrdinalIgnoreCase)
                    && invoiceStatus.Contains("UNKNOWN", StringComparison.OrdinalIgnoreCase) => "INVOICE_REVERSAL_UNKNOWN",
                _ when invoiceStatus.Contains("REVERS", StringComparison.OrdinalIgnoreCase) => "INVOICE_REVERSED",
                _ => "INVOICE_DRAFT"
            };
        }

        public static bool InvoiceBlocksGrn(string invoiceGate)
        {
            return invoiceGate is "INVOICE_POSTED" or "INVOICE_POSTING" or "INVOICE_REVERSAL_FAILED" or "INVOICE_REVERSAL_UNKNOWN";
        }

        public static bool NeedsLocalFinalization(string? grnStatus, string? reversalStatus, string? reversalMaterialDocument)
        {
            if (string.Equals(grnStatus, Common.SILA_GRN_REVERSED, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (string.Equals(reversalStatus, Common.SILA_POSTING_FAILED_LOCAL, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            return string.Equals(reversalStatus, Common.SILA_POSTING_ERP_ACCEPTED, StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(reversalMaterialDocument);
        }

        public static string Decide(
            bool grnPosted,
            bool invoiceBlocks,
            bool reversalConfigured,
            bool alreadyReversed,
            string? reversalStatus,
            bool hasMaterialDocument,
            bool needsLocalFinalization = false)
        {
            if (alreadyReversed || string.Equals(reversalStatus, Common.SILA_POSTING_POSTED, StringComparison.OrdinalIgnoreCase))
            {
                return ALREADY_REVERSED;
            }

            if (needsLocalFinalization)
            {
                return LOCAL_FINALIZE;
            }

            if (!grnPosted)
            {
                return NOT_POSTED;
            }

            if (string.Equals(reversalStatus, Common.SILA_POSTING_UNKNOWN, StringComparison.OrdinalIgnoreCase)
                || string.Equals(reversalStatus, "POSTING_UNKNOWN", StringComparison.OrdinalIgnoreCase))
            {
                return UNKNOWN;
            }

            if (string.Equals(reversalStatus, Common.SILA_POSTING_PENDING, StringComparison.OrdinalIgnoreCase))
            {
                return IN_FLIGHT;
            }

            if (invoiceBlocks)
            {
                return INVOICE_FIRST;
            }

            if (!hasMaterialDocument)
            {
                return MISSING_MATERIAL_DOCUMENT;
            }

            return reversalConfigured ? READY : NOT_CONFIGURED;
        }
    }
}
