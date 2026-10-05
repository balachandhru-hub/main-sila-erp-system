namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A Company Code Master row of the buyer.
    /// </summary>
    public class SilaCompanyCodeDto
    {
        public Guid Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Country { get; set; }
        public string? Currency { get; set; }
        public DateTime UpdatedOn { get; set; }
        /// <summary>ACTIVE | INACTIVE (suspended).</summary>
        public string Status { get; set; } = "ACTIVE";
    }
}
