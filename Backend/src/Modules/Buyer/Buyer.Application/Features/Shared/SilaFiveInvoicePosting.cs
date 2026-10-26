namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// FIVE S/4 invoice posting has time-dependent taxes active. The header TaxDeterminationDate is
    /// required and defaults to the invoice date. Another tenant does not inherit this rule.
    /// </summary>
    public static class SilaFiveInvoicePosting
    {
        public const string TAX_DATE_MISSING =
            "Field: TaxDeterminationDate. Tax Determination Date is required for FIVE S/4 invoice posting because time-dependent taxes are active.";

        /// <summary>True only for FIVE S4-INVOICE POSTING. The common invoice engine does not assume this for every tenant.</summary>
        public static bool TimeDependentTaxes(string? apiName)
        {
            return string.Equals(apiName?.Trim(), SilaInvoiceLifecycle.API_INVOICE, System.StringComparison.OrdinalIgnoreCase);
        }
    }
}
