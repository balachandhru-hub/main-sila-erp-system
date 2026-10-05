namespace Buyer.Domain.Dtos
{
    /// <summary>Whether a recipe version can be sent for approval, and why not.</summary>
    public class SilaRecipeReadinessDto
    {
        public bool Ready { get; set; }
        /// <summary>Every ingredient has an approved price and a unit conversion, so the total cost is complete.</summary>
        public bool CostComplete { get; set; }
        public List<string> Issues { get; set; } = new();
        /// <summary>ACTIVE | INACTIVE | PENDING APPROVAL | READY FOR APPROVAL | NOT READY (n): the label to show.</summary>
        public string Status { get; set; } = string.Empty;
    }
}
