namespace Buyer.Domain.Dtos
{
    /// <summary>The filter values of the ingredient search.</summary>
    public class SilaRecipeIngredientFacetsDto
    {
        public List<string> MaterialGroups { get; set; } = new();
        public List<string> Categories { get; set; } = new();
        public List<string> Suppliers { get; set; } = new();
        /// <summary>Inventory types of the active materials (STOCK, NON_STOCK, SERVICE).</summary>
        public List<string> MaterialTypes { get; set; } = new();
        /// <summary>The suppliers with id and code (SILA supplier master) or name only (purchase orders).</summary>
        public List<SilaRecipeSupplierOptionDto> SupplierOptions { get; set; } = new();
    }
}
