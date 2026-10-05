namespace Buyer.Domain.Dtos
{
    /// <summary>A material with its stock summed over the locations searched.</summary>
    public class SilaLiveInventoryRowDto
    {
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string BaseUom { get; set; } = string.Empty;
        public decimal OnHandQty { get; set; }
        public decimal InTransitQty { get; set; }
        /// <summary>Locations holding a balance of the material.</summary>
        public int LocationCount { get; set; }
    }
}
