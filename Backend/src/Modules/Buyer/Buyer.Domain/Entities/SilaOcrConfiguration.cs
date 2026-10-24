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

        /// <summary>LOCAL (the local downloads path), FILE_PATH, or SHAREPOINT. Null uses LOCAL.</summary>
        [MaxLength(20)]
        public string? AttachmentStorage { get; set; }

        /// <summary>Folder used when AttachmentStorage is FILE_PATH.</summary>
        [MaxLength(1000)]
        public string? AttachmentPath { get; set; }

        /// <summary>SharePoint site, for example https://tenant.sharepoint.com/sites/finance.</summary>
        [MaxLength(2000)]
        public string? SharePointSiteUrl { get; set; }

        /// <summary>SharePoint document library that holds invoice files.</summary>
        [MaxLength(200)]
        public string? SharePointLibrary { get; set; }

        /// <summary>Folder inside the document library. Empty means the library root.</summary>
        [MaxLength(400)]
        public string? SharePointFolder { get; set; }

        /// <summary>When false, the built-in / current OCR engine is skipped. Null = enabled.</summary>
        public bool? PrimaryOcrEnabled { get; set; }

        /// <summary>When true, configured AI providers run if OCR confidence is below the threshold.</summary>
        public bool? AiFallbackEnabled { get; set; }

        /// <summary>Safe provider rows (no secrets).</summary>
        public string? AiProvidersJson { get; set; }

        /// <summary>Encrypted provider-id to API key map. Never returned to the client.</summary>
        public string? AiProviderSecrets { get; set; }
    }
}
