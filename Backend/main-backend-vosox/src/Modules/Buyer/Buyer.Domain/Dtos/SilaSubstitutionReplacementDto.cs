namespace Buyer.Domain.Dtos
{
    /// <summary>Replace the ingredient material with the substitute material (quantity and unit are copied by the server).</summary>
    public class SilaSubstitutionReplacementDto
    {
        public Guid IngredientMaterialId { get; set; }
        public Guid SubstituteMaterialId { get; set; }
    }
}
