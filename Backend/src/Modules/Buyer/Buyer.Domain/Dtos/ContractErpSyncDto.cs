namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// How the hand-off of an executed contract to the buyer's ERP went.
    /// </summary>
    public class ContractErpSyncDto
    {
        public Guid ContractId { get; set; }
        public string? ContractNumber { get; set; }

        /// <summary>Id the ERP returned. Null until the ERP accepted the contract, or when no contract API is configured.</summary>
        public string? ErpContractId { get; set; }

        /// <summary>NOT_CONFIGURED, PENDING, SYNCED, FAILED or UNKNOWN.</summary>
        public string ErpSyncStatus { get; set; } = string.Empty;
        public string? ErpSyncError { get; set; }
    }
}
