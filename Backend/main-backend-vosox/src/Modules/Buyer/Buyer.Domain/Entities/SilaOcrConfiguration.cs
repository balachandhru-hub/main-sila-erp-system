using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class SilaOcrConfiguration : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string Provider { get; set; } = string.Empty;

        public bool AutoExtractOnUpload { get; set; }

        [Precision(18, 4)]
        public decimal MinimumConfidence { get; set; }

        // SILA ME parity (null = the default in SilaOcrSettings): amount tolerance for the financial reconciliation,
        // timeout and retries of the reader, falling back to the built-in reader when the external one fails, which
        // checks run after a reading, whether lines are read, and the reuse of a reading of an identical file.
        [Precision(18, 4)]
        public decimal? AmountTolerance { get; set; }

        public int? BackendTimeoutSeconds { get; set; }

        public int? BackendRetryCount { get; set; }

        public bool? AutoFallback { get; set; }

        public bool? AlwaysBackendOnReread { get; set; }

        public bool? DetailedLineExtraction { get; set; }

        public bool? SupplierValidation { get; set; }

        public bool? PoValidation { get; set; }

        public bool? FinancialReconciliation { get; set; }

        public bool? ReuseCachedOcr { get; set; }
    }
}
