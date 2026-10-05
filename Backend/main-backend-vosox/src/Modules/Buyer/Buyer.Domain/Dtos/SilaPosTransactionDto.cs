namespace Buyer.Domain.Dtos
{
    public class SilaPosTransactionDto
    {
        public Guid Id { get; set; }
        public Guid? BatchId { get; set; }
        public string? BatchNumber { get; set; }
        public string SourceTransactionId { get; set; } = string.Empty;
        public int LineNumber { get; set; }
        public DateTime BusinessDate { get; set; }
        public string OutletCode { get; set; } = string.Empty;
        public Guid? OutletLocationId { get; set; }
        public string? OutletLocationName { get; set; }
        public string PosCode { get; set; } = string.Empty;
        public Guid? RecipeId { get; set; }
        public string? RecipeCode { get; set; }
        public string? RecipeName { get; set; }
        public decimal QuantitySold { get; set; }
        public decimal? Amount { get; set; }
        public string? Uom { get; set; }
        public string? Currency { get; set; }
        /// <summary>RECEIVED | INVENTORY_DEDUCTED | POSTED | FAILED, including the outcome of the ERP posting.</summary>
        public string Status { get; set; } = string.Empty;
        /// <summary>MATCH | DEDUCT | POST when failed.</summary>
        public string? FailedStep { get; set; }
        public string? FailureMessage { get; set; }
        /// <summary>DONE | FAILED | PENDING</summary>
        public string ReceivedState { get; set; } = string.Empty;
        /// <summary>DONE | FAILED | PENDING</summary>
        public string DeductState { get; set; } = string.Empty;
        /// <summary>DONE | FAILED | PENDING | SKIPPED</summary>
        public string PostState { get; set; } = string.Empty;
        public Guid? ErpPostingId { get; set; }
        public string? ErpPostingStatus { get; set; }
        public string? ErpReference { get; set; }
        public DateTime? PostedOn { get; set; }
        public bool CanReprocess { get; set; }
        public DateTime DateCreated { get; set; }
        /// <summary>Recipe version whose ingredients were consumed (the active version at matching).</summary>
        public int? RecipeVersion { get; set; }
        /// <summary>OUTLET | STORE ... of the matched location.</summary>
        public string? LocationType { get; set; }
        /// <summary>Step 1 (SILA inventory: match and deduct): DONE | FAILED | PENDING, with its message.</summary>
        public string Step1Status { get; set; } = string.Empty;
        public string? Step1Message { get; set; }
        /// <summary>Step 2 (ERP posting): DONE | FAILED | PENDING | SKIPPED | UNKNOWN, with its message.</summary>
        public string Step2Status { get; set; } = string.Empty;
        public string? Step2Message { get; set; }
        /// <summary>HTTP status of the last ERP call; null when none answered.</summary>
        public int? ErpHttpStatus { get; set; }
        /// <summary>Integration system (API) used for the ERP posting.</summary>
        public string? IntegrationSystem { get; set; }
        /// <summary>ERP movement type of the consumption posting.</summary>
        public string? MovementType { get; set; }
        /// <summary>MATCH_FAILED | DEDUCT_FAILED | ERP_FAILED | ERP_UNKNOWN; null when nothing failed.</summary>
        public string? FailureCode { get; set; }
        /// <summary>Menu item sold: the recipe's POS item, else its name.</summary>
        public string? MenuItem { get; set; }
        /// <summary>Number of the inventory consumption transaction of the sale (first one when several).</summary>
        public string? ConsumptionTransactionNumber { get; set; }
    }
}
