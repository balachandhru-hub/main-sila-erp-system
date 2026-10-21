namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// PROTECTED / FROZEN SILA SAP flows. Unrelated features must not change these orchestrators or mappers.
    /// 1 GRN preparation — PostSilaGoodsReceipt
    /// 2 GRN SAP 101 posting — PostPendingErpPostings (BuildGrnAsync / SapGrnBody) + SilaGrnSap
    /// 3 GRN reprocessing — ReprocessSilaErpPosting (same 101 mapper)
    /// 4 GRN reversal preparation — GetSilaGoodsReceiptReversal
    /// 5 GRN SAP 102 reversal — ReverseSilaGoodsReceipt + SilaGrnSap.ReversalBody
    /// 6 GRN reversal reprocessing — ReverseSilaGoodsReceipt local-finalization / failed retry
    /// 7 Invoice S/4 refresh — RefreshSilaInvoicePosting (GET PO only here)
    /// 8 Invoice prepared posting data — SilaInvoicePostingData
    /// 9 Invoice SAP posting — SilaInvoicePosting.ContinueAsync + PostPendingErpPostings invoice path
    /// 10 Invoice resubmit — SubmitSilaInvoice / ContinueAsync (no GET PO)
    /// </summary>
    public static class SilaProtectedFlows
    {
        public const string GrnPostingIntegration = SilaGrnSap.API_CONFIG_NAME;
        public const string GrnReversalIntegration = SilaGrnSap.REVERSAL_API_CONFIG_NAME;
        public const string InvoicePostingIntegration = SilaInvoiceLifecycle.API_INVOICE;
        public const string InvoiceGetPoIntegration = SilaInvoiceLifecycle.API_GET_PO;
    }
}
