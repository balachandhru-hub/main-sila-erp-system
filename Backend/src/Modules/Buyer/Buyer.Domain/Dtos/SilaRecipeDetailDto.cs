namespace Buyer.Domain.Dtos
{
    public class SilaRecipeDetailDto
    {
        public Guid Id { get; set; }
        public string RecipeCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Category { get; set; }
        public Guid? FamilyId { get; set; }
        public string? FamilyName { get; set; }
        public Guid? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public string ItemMode { get; set; } = string.Empty;
        public decimal ServingQty { get; set; }
        public string ServingUom { get; set; } = string.Empty;
        public string SellingUom { get; set; } = string.Empty;
        /// <summary>
        /// Name, serving, selling UOM and POS code above are the header of the shown version: the pending values when the
        /// pending version is shown, otherwise the active values (what POS sales use).
        /// </summary>
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
        /// <summary>The version whose ingredients and prices are shown.</summary>
        public int ViewVersion { get; set; }
        /// <summary>Status of the shown version: ACTIVE, DRAFT, PENDING_APPROVAL, REJECTED or SUPERSEDED.</summary>
        public string ViewStatus { get; set; } = string.Empty;
        public List<SilaRecipeVersionDto> Versions { get; set; } = new();
        /// <summary>Total cost of the shown version.</summary>
        public decimal TotalCost { get; set; }
        /// <summary>TotalCost / ServingQty of the shown version: what cost % and margin compare with the menu price.</summary>
        public decimal CostPerServing { get; set; }
        /// <summary>POS item description.</summary>
        public string? PosItem { get; set; }
        /// <summary>Business date of the last POS sale consumed for the recipe (set by POS processing).</summary>
        public DateTime? LastSaleDate { get; set; }
        public SilaRecipeReadinessDto Readiness { get; set; } = new();
        public string? Currency { get; set; }
        public Guid? SubmittedBy { get; set; }
        public string? SubmittedByName { get; set; }
        public DateTime? SubmittedOn { get; set; }
        public DateTime? ApprovedOn { get; set; }
        /// <summary>The signed-in user is the approver whose turn it is.</summary>
        public bool CanDecide { get; set; }
        public List<SilaRecipeIngredientDto> Ingredients { get; set; } = new();
        public List<SilaRecipeOutletPriceDto> OutletPrices { get; set; } = new();
        /// <summary>Approval steps of every version, newest version first.</summary>
        public List<SilaRecipeApprovalStepDto> ApprovalSteps { get; set; } = new();
        /// <summary>Created, new version, submitted, approved, rejected, deactivated.</summary>
        public List<SilaRecipeEventDto> History { get; set; } = new();
    }
}
