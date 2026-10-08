namespace Buyer.Domain.Dtos
{
    public class SilaRecipeOutletPriceDto
    {
        public Guid Id { get; set; }
        public Guid OutletLocationId { get; set; }
        public string? LocationCode { get; set; }
        public string? LocationName { get; set; }
        public decimal MenuPrice { get; set; }
        public string? Currency { get; set; }
        /// <summary>Cost of one serving (TotalCost / ServingQty).</summary>
        public decimal CostPerServing { get; set; }
        /// <summary>CostPerServing / MenuPrice x 100; null when the price is zero.</summary>
        public decimal? CostPercent { get; set; }
        /// <summary>MenuPrice - CostPerServing; null when the price is zero.</summary>
        public decimal? MarginAmount { get; set; }
        /// <summary>(MenuPrice - CostPerServing) / MenuPrice x 100; null when the price is zero.</summary>
        public decimal? MarginPercent { get; set; }
    }
}
