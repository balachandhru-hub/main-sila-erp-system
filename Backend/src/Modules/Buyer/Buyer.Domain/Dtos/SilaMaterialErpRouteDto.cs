namespace Buyer.Domain.Dtos
{
    /// <summary>The GET_MATERIAL API used for a company code (its own, else the organization-wide one) and its last sync.</summary>
    public class SilaMaterialErpRouteDto
    {
        public bool Configured { get; set; }
        public string? CompanyCode { get; set; }
        public string? ConfigurationName { get; set; }
        public string? SystemName { get; set; }
        /// <summary>The entity code of the configuration: the company code, or ALL.</summary>
        public string? EntityCode { get; set; }
        public DateTime? LastSyncAt { get; set; }
        public string? LastError { get; set; }
    }
}
