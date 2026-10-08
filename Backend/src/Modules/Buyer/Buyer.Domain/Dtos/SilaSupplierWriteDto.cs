namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A Supplier Master row to create or change.
    /// </summary>
    public class SilaSupplierWriteDto
    {
        public string SupplierCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? TaxNumber { get; set; }
        public List<string>? Aliases { get; set; }
        public string? Country { get; set; }
        /// <summary>ACTIVE (default) or INACTIVE.</summary>
        public string? Status { get; set; }
        public Guid? SupplierOrganizationId { get; set; }
        public string? LegalName { get; set; }
        public string? City { get; set; }
        public string? Address { get; set; }
        /// <summary>3-letter ISO code.</summary>
        public string? Currency { get; set; }
    }
}
