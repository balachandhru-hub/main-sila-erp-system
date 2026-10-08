namespace Buyer.Domain.Dtos
{
    public class SilaRecipeOutletPriceWriteDto
    {
        /// <summary>An inventory location of type OUTLET.</summary>
        public Guid OutletLocationId { get; set; }
        public decimal MenuPrice { get; set; }
        public string? Currency { get; set; }
    }
}
