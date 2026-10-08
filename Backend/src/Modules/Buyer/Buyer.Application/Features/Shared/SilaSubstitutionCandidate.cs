using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// A material that can replace a short recipe ingredient in one property: the line it becomes (quantity and unit copied
    /// from the replaced ingredient, converted to a unit the substitute supports) and what it costs.
    /// </summary>
    public class SilaSubstitutionCandidate
    {
        public ItemBuyerMaster Material { get; set; } = null!;
        public decimal Available { get; set; }
        public decimal Quantity { get; set; }
        public string Uom { get; set; } = string.Empty;
        public decimal BaseQuantity { get; set; }
        public decimal LineCost { get; set; }
        /// <summary>LineCost minus the cost of the replaced line.</summary>
        public decimal CostDelta { get; set; }
    }
}
