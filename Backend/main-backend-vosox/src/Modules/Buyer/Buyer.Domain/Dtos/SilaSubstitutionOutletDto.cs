namespace Buyer.Domain.Dtos
{
    /// <summary>The menu price of the recipe at one outlet with its cost and margin percentages.</summary>
    public class SilaSubstitutionOutletDto
    {
        public Guid OutletLocationId { get; set; }
        public string LocationCode { get; set; } = string.Empty;
        public string LocationName { get; set; } = string.Empty;
        public decimal MenuPrice { get; set; }
        public string? Currency { get; set; }
        public decimal? CostPercent { get; set; }
        public decimal? MarginPercent { get; set; }
    }
}
