namespace Buyer.Domain.Dtos
{
    /// <summary>Recipe management overview.</summary>
    public class SilaRecipeDashboardDto
    {
        /// <summary>Recipes with an approved version that sells.</summary>
        public int ActiveRecipes { get; set; }
        public int DraftRecipes { get; set; }
        /// <summary>Every recipe of the organization (any status).</summary>
        public int TotalRecipes { get; set; }
        /// <summary>Active Item Master materials.</summary>
        public int MaterialCount { get; set; }
        /// <summary>Recipes whose current approval level is the signed-in user.</summary>
        public int PendingMyApproval { get; set; }
        public int PendingApprovalTotal { get; set; }
        public int FailedPosSales { get; set; }
        /// <summary>Recipe consumption movements posted today (UTC).</summary>
        public int ConsumptionPostedToday { get; set; }
        public List<SilaRecipeNextActionDto> NextActions { get; set; } = new();
    }
}
