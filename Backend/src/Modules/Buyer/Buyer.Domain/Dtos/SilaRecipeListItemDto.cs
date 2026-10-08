namespace Buyer.Domain.Dtos
{
    public class SilaRecipeListItemDto
    {
        public Guid Id { get; set; }
        public string RecipeCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        /// <summary>Category name (kept for display; the master is CategoryId).</summary>
        public string? Category { get; set; }
        public Guid? FamilyId { get; set; }
        public string? FamilyName { get; set; }
        public Guid? CategoryId { get; set; }
        public string ItemMode { get; set; } = string.Empty;
        public decimal ServingQty { get; set; }
        public string ServingUom { get; set; } = string.Empty;
        public string SellingUom { get; set; } = string.Empty;
        /// <summary>Name, serving, selling UOM and POS code above are the active version's (what POS sales use).</summary>
        public string? PosCode { get; set; }
        /// <summary>The pending version of an approved recipe has its own header (the Draft* fields below).</summary>
        public bool HasDraftHeader { get; set; }
        /// <summary>Header of the pending version; null when there is none (DraftPosCode null with HasDraftHeader = no POS code).</summary>
        public string? DraftName { get; set; }
        public string? DraftPosCode { get; set; }
        public decimal? DraftServingQty { get; set; }
        public string? DraftServingUom { get; set; }
        public string? DraftSellingUom { get; set; }
        public string Status { get; set; } = string.Empty;
        /// <summary>The latest version (the one Status describes).</summary>
        public int Version { get; set; }
        /// <summary>The approved version POS sales use; 0 when never approved.</summary>
        public int ActiveVersion { get; set; }
        /// <summary>The latest version has no readiness issue.</summary>
        public bool Ready { get; set; }
        public int IssueCount { get; set; }
        public bool CostComplete { get; set; }
        /// <summary>Cost of the selling (active) version; of the latest version when nothing was approved yet.</summary>
        public decimal TotalCost { get; set; }
        /// <summary>Cost of the pending version of an approved recipe; null when there is none.</summary>
        public decimal? DraftTotalCost { get; set; }
        /// <summary>TotalCost / ServingQty: the cost of one serving.</summary>
        public decimal CostPerServing { get; set; }
        /// <summary>ACTIVE | INACTIVE | PENDING APPROVAL | READY FOR APPROVAL | NOT READY (n).</summary>
        public string ReadinessStatus { get; set; } = string.Empty;
        /// <summary>POS item description.</summary>
        public string? PosItem { get; set; }
        /// <summary>Business date of the last POS sale consumed for the recipe.</summary>
        public DateTime? LastSaleDate { get; set; }
        public string? Currency { get; set; }
        public int IngredientCount { get; set; }
        public int OutletCount { get; set; }
        public DateTime? SubmittedOn { get; set; }
        public DateTime? ApprovedOn { get; set; }
        public DateTime DateUpdated { get; set; }
        /// <summary>Approval list only: CREATE (never approved) or CHANGE (new version of an approved recipe).</summary>
        public string? ApprovalEvent { get; set; }
        /// <summary>Approval list only: the level waiting for a decision (1-based) and the number of levels.</summary>
        public int? ApprovalLevel { get; set; }
        public int? ApprovalLevelCount { get; set; }
        /// <summary>Approval list only: the approver of the current level and their role.</summary>
        public string? ApproverName { get; set; }
        public string? ApproverRole { get; set; }
    }
}
