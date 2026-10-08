namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// How the buyer's invoices are read.
    /// </summary>
    public class SilaOcrConfigurationDto
    {
        /// <summary>BUILT_IN (the OCR service) or EXTERNAL (the EXTRACT_INVOICE integration).</summary>
        public string Provider { get; set; } = string.Empty;
        public bool AutoExtractOnUpload { get; set; }
        /// <summary>0..1; a reading below it marks the invoice for review.</summary>
        public decimal MinimumConfidence { get; set; }
        /// <summary>Whether an active EXTRACT_INVOICE integration exists.</summary>
        public bool ExternalConfigured { get; set; }
        /// <summary>False while the defaults are shown (nothing saved yet).</summary>
        public bool Saved { get; set; }
        public DateTime? UpdatedOn { get; set; }
        /// <summary>The effective settings (defaults applied); see SilaOcrConfigurationWriteDto.</summary>
        public decimal AmountTolerance { get; set; }
        public int BackendTimeoutSeconds { get; set; }
        public int BackendRetryCount { get; set; }
        public bool AutoFallback { get; set; }
        public bool AlwaysBackendOnReread { get; set; }
        public bool DetailedLineExtraction { get; set; }
        public bool SupplierValidation { get; set; }
        public bool PoValidation { get; set; }
        public bool FinancialReconciliation { get; set; }
        public bool ReuseCachedOcr { get; set; }
    }
}
