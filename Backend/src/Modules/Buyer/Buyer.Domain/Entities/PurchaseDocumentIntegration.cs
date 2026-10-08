using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    /// <summary>
    /// One purchase order hand-off to the ERP: of a weekly bucket (one row per supplier of the bucket) or of a purchase order created from a contract.
    /// </summary>
    public class PurchaseDocumentIntegration : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        public Guid? WeeklyBucketId { get; set; }

        /// <summary>
        /// Purchase order sent, for a hand-off created from a contract.
        /// </summary>
        public Guid? PurchaseOrderId { get; set; }

        /// <summary>
        /// Contract of the purchase order, for a hand-off created from a contract.
        /// </summary>
        public Guid? ContractId { get; set; }

        [Required]
        public Guid BuyerOrganizationId { get; set; }

        /// <summary>
        /// Supplier id of the bucket lines sent on this purchase order.
        /// </summary>
        public Guid SupplierOrganizationId { get; set; }

        [Required]
        public string IntegrationType { get; set; } = string.Empty;

        [Required]
        public string IdempotencyKey { get; set; } = string.Empty;

        public string? DocumentType { get; set; }

        public string? ExternalDocumentNumber { get; set; }

        [Required]
        public string Status { get; set; } = string.Empty;

        public Guid? ConfigurationId { get; set; }

        public int ConfigurationVersion { get; set; }

        public string? ResolvedBaseUrl { get; set; }

        public string? ResolvedPath { get; set; }

        public string? ResolvedHttpMethod { get; set; }

        public string? ResolvedErpType { get; set; }

        public string? ErrorMessage { get; set; }

        public int RetryCount { get; set; }

        public DateTime? LastAttemptOn { get; set; }

        public DateTime? NextAttemptOn { get; set; }

        public string? CorrelationId { get; set; }

        public string? ResponseBody { get; set; }

        public bool OutcomeUnknown { get; set; }
    }
}
