namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Outcome of an ERP material pull: records read, materials created, changed (fields updated or a price change
    /// requested), unchanged and failed, with a message per failed record.
    /// </summary>
    public class SilaMaterialErpPullResultDto
    {
        public string ConfigurationName { get; set; } = string.Empty;
        public int Read { get; set; }
        public int New { get; set; }
        public int Changed { get; set; }
        public int Unchanged { get; set; }
        public int Failed { get; set; }
        /// <summary>Price change requests created for approval.</summary>
        public int PriceChanges { get; set; }
        public List<string> Failures { get; set; } = new();
    }
}
