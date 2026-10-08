namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A company code to create or change.
    /// </summary>
    public class SilaCompanyCodeWriteDto
    {
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Country { get; set; }
        public string? Currency { get; set; }
    }
}
