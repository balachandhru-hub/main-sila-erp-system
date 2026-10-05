namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// The invoice reading settings to save.
    /// </summary>
    public class SilaOcrConfigurationWriteDto
    {
        public string Provider { get; set; } = string.Empty;
        public bool AutoExtractOnUpload { get; set; }
        public decimal MinimumConfidence { get; set; }
        /// <summary>Net + tax may differ from gross by this amount (default 0.05).</summary>
        public decimal? AmountTolerance { get; set; }
        /// <summary>Reader timeout, 1 to 600 seconds (default 60).</summary>
        public int? BackendTimeoutSeconds { get; set; }
        /// <summary>Retries of an unreachable built-in reader, 0 to 5 (default 1).</summary>
        public int? BackendRetryCount { get; set; }
        /// <summary>Read with the built-in reader when the external one fails (default on).</summary>
        public bool? AutoFallback { get; set; }
        /// <summary>A re-read always uses the configured backend reader, never a cached reading (default on).</summary>
        public bool? AlwaysBackendOnReread { get; set; }
        /// <summary>Read invoice lines, not only the header (default on).</summary>
        public bool? DetailedLineExtraction { get; set; }
        /// <summary>Flag a reading whose supplier is not in the Supplier Master for review (default off).</summary>
        public bool? SupplierValidation { get; set; }
        /// <summary>Flag a reading whose PO number is not a known purchase order for review (default off).</summary>
        public bool? PoValidation { get; set; }
        /// <summary>Warn when net + tax differs from gross by more than the tolerance (default on).</summary>
        public bool? FinancialReconciliation { get; set; }
        /// <summary>Reuse the reading of an identical file (same SHA-256) instead of reading again (default off).</summary>
        public bool? ReuseCachedOcr { get; set; }
    }
}
