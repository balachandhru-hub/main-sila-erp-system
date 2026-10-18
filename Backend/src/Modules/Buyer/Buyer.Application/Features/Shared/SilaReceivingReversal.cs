namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Decides whether a goods-receipt reversal may start.
    /// A posted supplier invoice blocks the goods receipt. No reversal API means the request is stored and not sent.
    /// </summary>
    public static class SilaReceivingReversal
    {
        public const string NOT_POSTED = "NOT_POSTED";
        public const string INVOICE_FIRST = "INVOICE_REVERSAL_REQUIRED";
        public const string NOT_CONFIGURED = "NOT CONFIGURED";
        public const string READY = "READY";

        public static string Decide(bool grnPosted, bool invoicePostedToSap, bool reversalConfigured)
        {
            if (!grnPosted)
            {
                return NOT_POSTED;
            }

            if (invoicePostedToSap)
            {
                return INVOICE_FIRST;
            }

            return reversalConfigured ? READY : NOT_CONFIGURED;
        }
    }
}
