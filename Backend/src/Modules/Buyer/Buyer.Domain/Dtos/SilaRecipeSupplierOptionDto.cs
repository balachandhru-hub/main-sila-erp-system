namespace Buyer.Domain.Dtos
{
    /// <summary>A supplier offered as an ingredient search filter. Id and Code are null for a name only seen on purchase orders.</summary>
    public class SilaRecipeSupplierOptionDto
    {
        public Guid? Id { get; set; }
        public string? Code { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}
