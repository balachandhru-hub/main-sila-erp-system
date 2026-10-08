using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// What a location write is checked against, loaded once: the buyer's active properties and outlets and all its
    /// locations (also deactivated ones, because location codes stay unique). The Excel import adds the rows it creates.
    /// </summary>
    public class SilaLocationContext
    {
        public Dictionary<Guid, BuyerProperty> Properties { get; set; } = new();
        public List<BuyerOutlet> Outlets { get; set; } = new();
        public List<InventoryLocation> Locations { get; set; } = new();
    }
}
