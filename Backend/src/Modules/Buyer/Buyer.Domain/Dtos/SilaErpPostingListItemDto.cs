namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A SILA ME document waiting for, or posted to, the ERP.
    /// </summary>
    public class SilaErpPostingListItemDto
    {
        public Guid Id { get; set; }
        public string ReferenceType { get; set; } = string.Empty;
        public Guid ReferenceId { get; set; }
        public string ReferenceNumber { get; set; } = string.Empty;
        public Guid? LocationId { get; set; }
        public string? LocationName { get; set; }
        public string MovementType { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int Attempts { get; set; }
        public string? ErpReference { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime? PostedOn { get; set; }
        public DateTime CreatedOn { get; set; }

        /// <summary>Company code the ERP API is chosen by (falls back to the ALL API).</summary>
        public string? CompanyCode { get; set; }
    }
}
