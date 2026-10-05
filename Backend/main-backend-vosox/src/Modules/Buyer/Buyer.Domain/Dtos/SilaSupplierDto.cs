namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A Supplier Master row of the buyer.
    /// </summary>
    public class SilaSupplierDto
    {
        public Guid Id { get; set; }
        public string SupplierCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? TaxNumber { get; set; }
        public List<string> Aliases { get; set; } = new();
        public string? Country { get; set; }
        public string Status { get; set; } = string.Empty;
        public Guid? SupplierOrganizationId { get; set; }
        public DateTime UpdatedOn { get; set; }
        /// <summary>Tax registration number (same as TaxNumber).</summary>
        public string? Trn { get; set; }
        public string? LegalName { get; set; }
        public string? City { get; set; }
        public string? Address { get; set; }
        public string? Currency { get; set; }
        /// <summary>Status BLOCKED.</summary>
        public bool IsBlocked { get; set; }
    }
}
