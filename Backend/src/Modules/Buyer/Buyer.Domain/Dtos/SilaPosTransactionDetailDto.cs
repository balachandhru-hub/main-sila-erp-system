namespace Buyer.Domain.Dtos
{
    /// <summary>A POS sale with its consumed ingredients, its processing timeline and its ERP posting.</summary>
    public class SilaPosTransactionDetailDto
    {
        public SilaPosTransactionDto Transaction { get; set; } = new();
        public string? PosSourceName { get; set; }
        public string? BatchStatus { get; set; }
        public string? OutletLocationCode { get; set; }
        public int? RecipeActiveVersion { get; set; }
        public List<SilaPosConsumptionLineDto> Lines { get; set; } = new();
        public List<SilaPosTimelineEventDto> Timeline { get; set; } = new();
        public string? ErpMovementType { get; set; }
        public int ErpAttempts { get; set; }
        public string? ErpErrorMessage { get; set; }
        public DateTime? ErpLastAttemptOn { get; set; }
        /// <summary>Last ERP request and response, credentials masked and truncated to 4000 characters.</summary>
        public string? ErpRequest { get; set; }
        public string? ErpResponse { get; set; }
        public int? ErpHttpStatus { get; set; }
        /// <summary>MATCH_FAILED | DEDUCT_FAILED | ERP_FAILED | ERP_UNKNOWN; null when nothing failed.</summary>
        public string? FailureCode { get; set; }
    }
}
