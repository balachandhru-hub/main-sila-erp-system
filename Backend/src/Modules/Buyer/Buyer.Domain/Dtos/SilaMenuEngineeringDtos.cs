namespace Buyer.Domain.Dtos
{
    public class SilaMenuEngineeringFilterDto
    {
        public Guid? PropertyId { get; set; }
        public Guid? OutletLocationId { get; set; }
        public DateTime? DateFrom { get; set; }
        public DateTime? DateTo { get; set; }
        public string? MealPeriod { get; set; }
        public string? Category { get; set; }
        public string? Search { get; set; }
        public string? Status { get; set; }
        public Guid? MenuItemId { get; set; }
        public Guid? MenuPlanId { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 50;
    }

    public class SilaMenuEngineeringEnvelopeDto
    {
        public string View { get; set; } = string.Empty;
        public SilaMenuDashboardDto? Dashboard { get; set; }
        public SilaMenuItemPageDto? Items { get; set; }
        public SilaMenuItemDetailDto? Item { get; set; }
        public SilaMenuPlanPageDto? Plans { get; set; }
        public SilaMenuPlanDetailDto? Plan { get; set; }
        public SilaPmsDemandDto? Demand { get; set; }
        public SilaMenuPosSalesDto? PosSales { get; set; }
        public SilaMenuPosMappingPageDto? PosMappings { get; set; }
        public SilaMenuPerformanceDto? Performance { get; set; }
        public SilaMenuConsumptionDto? Consumption { get; set; }
        public SilaMenuCostMarginDto? CostMargin { get; set; }
        public SilaMenuRequirementDto? Requirements { get; set; }
        public SilaMenuRecommendationDto? Recommendations { get; set; }
        public SilaMenuIntelligenceDto? Intelligence { get; set; }
        public SilaMenuWhatIfResultDto? Simulation { get; set; }
        public SilaMenuEngineeringSettingsDto? Settings { get; set; }
        public SilaMenuLookupsDto? Lookups { get; set; }
        public Guid? SavedId { get; set; }
        public string? Message { get; set; }
    }

    public class SilaMenuLookupsDto
    {
        public List<SilaMenuNamedRefDto> Properties { get; set; } = new();
        public List<SilaMenuNamedRefDto> Outlets { get; set; } = new();
        public List<string> MealPeriods { get; set; } = new();
        public List<string> Categories { get; set; } = new();
        public List<SilaMenuNamedRefDto> Recipes { get; set; } = new();
    }

    public class SilaMenuNamedRefDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Code { get; set; }
        public Guid? PropertyId { get; set; }
    }

    public class SilaMenuDashboardDto
    {
        public decimal FoodRevenue { get; set; }
        public decimal FoodCost { get; set; }
        public decimal? FoodCostPercent { get; set; }
        public decimal GrossMargin { get; set; }
        public decimal? AverageCostPerPortion { get; set; }
        public decimal MenuItemsSold { get; set; }
        public decimal ExpectedCovers { get; set; }
        public decimal PlannedPortions { get; set; }
        public decimal TheoreticalConsumption { get; set; }
        public decimal ActualConsumption { get; set; }
        public decimal ConsumptionVariance { get; set; }
        public decimal? VarianceValue { get; set; }
        public decimal ForecastShortage { get; set; }
        public decimal PurchaseRecommendationValue { get; set; }
        public int Stars { get; set; }
        public int Plowhorses { get; set; }
        public int Puzzles { get; set; }
        public int Dogs { get; set; }
        public int MissingRecipes { get; set; }
        public int UnmappedPos { get; set; }
        public int MissingCost { get; set; }
        public int Shortages { get; set; }
        public string? OccupancySource { get; set; }
        public string? OccupancyFreshness { get; set; }
        public decimal? OccupancyPercent { get; set; }
        public decimal? ExpectedGuests { get; set; }
        public List<SilaMenuAttentionDto> Attention { get; set; } = new();
        public List<SilaMenuInsightDto> Insights { get; set; } = new();
        public List<SilaMenuPlanSummaryDto> TodayMenus { get; set; } = new();
        public List<SilaMenuPerformanceRowDto> TopPerformers { get; set; } = new();
        public List<SilaMenuRequirementRowDto> ShortIngredientRows { get; set; } = new();
    }

    public class SilaMenuAttentionDto
    {
        public string Kind { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Priority { get; set; } = "ACTION";
        public string? Route { get; set; }
        public Guid? MenuItemId { get; set; }
        public Guid? MenuPlanId { get; set; }
        public Guid? MaterialId { get; set; }
    }

    public class SilaMenuItemPageDto
    {
        public List<SilaMenuItemDetailDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; }
    }

    public class SilaMenuItemWriteDto
    {
        public Guid? Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Category { get; set; }
        public string? SubCategory { get; set; }
        public string? Cuisine { get; set; }
        public string? Classification { get; set; }
        public string? MealPeriods { get; set; }
        public decimal? SellingPrice { get; set; }
        public string? Currency { get; set; }
        public decimal DefaultPortionQty { get; set; } = 1;
        public string? PortionUom { get; set; }
        public decimal? AdultPortionFactor { get; set; }
        public decimal? ChildPortionFactor { get; set; }
        public decimal? DefaultParticipationRate { get; set; }
        public decimal? DefaultBufferPercentage { get; set; }
        public string? ServiceType { get; set; }
        public string? DietaryTags { get; set; }
        public string? AllergenNotes { get; set; }
        public string? ImagePath { get; set; }
        public Guid? PropertyId { get; set; }
        public Guid? OutletLocationId { get; set; }
        public DateTime? EffectiveFrom { get; set; }
        public DateTime? EffectiveTo { get; set; }
        public string? Status { get; set; }
        public Guid? LinkedRecipeId { get; set; }
        public string? RecipeLinkStatus { get; set; }
    }

    public class SilaMenuItemDetailDto : SilaMenuItemWriteDto
    {
        public string MenuItemCode { get; set; } = string.Empty;
        public string RecipeName { get; set; } = string.Empty;
        public string RecipeStatus { get; set; } = string.Empty;
        public decimal? RecipeCost { get; set; }
        public decimal? FoodCostPercent { get; set; }
        public decimal? ContributionMargin { get; set; }
        public string CostState { get; set; } = "COST_PENDING";
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class SilaMenuPlanPageDto
    {
        public List<SilaMenuPlanSummaryDto> Items { get; set; } = new();
        public int Total { get; set; }
    }

    public class SilaMenuPlanSummaryDto
    {
        public Guid Id { get; set; }
        public string PlanCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? PropertyName { get; set; }
        public string? OutletName { get; set; }
        public DateTime BusinessDate { get; set; }
        public string? MealPeriod { get; set; }
        public decimal? ExpectedGuests { get; set; }
        public decimal? ExpectedCovers { get; set; }
        public string Status { get; set; } = string.Empty;
        public int LineCount { get; set; }
        public int MissingRecipes { get; set; }
    }

    public class SilaMenuPlanWriteDto
    {
        public Guid? Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public Guid? PropertyId { get; set; }
        public Guid? OutletLocationId { get; set; }
        public DateTime BusinessDate { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? MealPeriod { get; set; }
        public string? EventName { get; set; }
        public decimal? ExpectedGuests { get; set; }
        public decimal? ExpectedCovers { get; set; }
        public decimal? MealParticipation { get; set; }
        public string? Status { get; set; }
        public string? Notes { get; set; }
        public Guid? CopyFromPlanId { get; set; }
        public List<SilaMenuPlanLineWriteDto> Lines { get; set; } = new();
    }

    public class SilaMenuPlanLineWriteDto
    {
        public Guid? Id { get; set; }
        public Guid MenuItemId { get; set; }
        public decimal? ParticipationRate { get; set; }
        public decimal? BufferPercentage { get; set; }
        public decimal? AdultFactor { get; set; }
        public decimal? ChildFactor { get; set; }
        public decimal? PlannedPortions { get; set; }
        public string? OverrideReason { get; set; }
        public bool? ConfirmPortions { get; set; }
    }

    public class SilaMenuPlanDetailDto : SilaMenuPlanWriteDto
    {
        public string PlanCode { get; set; } = string.Empty;
        public string? PropertyName { get; set; }
        public string? OutletName { get; set; }
        public new List<SilaMenuPlanLineDto> Lines { get; set; } = new();
    }

    public class SilaMenuPlanLineDto : SilaMenuPlanLineWriteDto
    {
        public string MenuItemName { get; set; } = string.Empty;
        public string MenuItemCode { get; set; } = string.Empty;
        public string RecipeLinkStatus { get; set; } = string.Empty;
        public decimal RecommendedPortions { get; set; }
        public bool PortionsConfirmed { get; set; }
        public decimal? ActualPortions { get; set; }
        public decimal? Variance { get; set; }
        public string? Warning { get; set; }
    }

    public class SilaPmsDemandWriteDto
    {
        public Guid? PropertyId { get; set; }
        public DateTime BusinessDate { get; set; }
        public decimal? OccupancyPercent { get; set; }
        public decimal? RoomsAvailable { get; set; }
        public decimal? RoomsOccupied { get; set; }
        public decimal? ExpectedGuests { get; set; }
        public decimal? Adults { get; set; }
        public decimal? Children { get; set; }
        public decimal? Arrivals { get; set; }
        public decimal? Departures { get; set; }
        public decimal? Stayovers { get; set; }
        public decimal? Reservations { get; set; }
        public decimal? ForecastReservations { get; set; }
        public decimal? GroupBookings { get; set; }
        public string? MealPlans { get; set; }
        public string? Events { get; set; }
    }

    public class SilaPmsDemandDto : SilaPmsDemandWriteDto
    {
        public Guid Id { get; set; }
        public string Source { get; set; } = "MANUAL";
        public string Provider { get; set; } = "OPERA";
        public string Status { get; set; } = string.Empty;
        public DateTime? SourceTimestamp { get; set; }
        public DateTime? LastSuccessfulSync { get; set; }
        public string? Freshness { get; set; }
        public string? Message { get; set; }
        public List<SilaMenuDemandDayDto> Days { get; set; } = new();
    }

    public class SilaMenuDemandDayDto
    {
        public DateTime BusinessDate { get; set; }
        public decimal? OccupancyPercent { get; set; }
        public decimal? ExpectedGuests { get; set; }
        public decimal? ExpectedCovers { get; set; }
        public decimal RecommendedPortions { get; set; }
        public decimal PlannedPortions { get; set; }
        public decimal IngredientRequirement { get; set; }
        public decimal AvailableInventory { get; set; }
        public decimal OpenPoCoverage { get; set; }
        public decimal Shortage { get; set; }
        public string Source { get; set; } = "MANUAL";
        public string? Freshness { get; set; }
    }

    public class SilaMenuPosSalesDto
    {
        public decimal QtySold { get; set; }
        public decimal Revenue { get; set; }
        public int TransactionCount { get; set; }
        public int UnmappedCount { get; set; }
        public DateTime? LastSync { get; set; }
        public string? SyncStatus { get; set; }
        public List<SilaMenuPosSaleRowDto> Rows { get; set; } = new();
    }

    public class SilaMenuPosSaleRowDto
    {
        public Guid Id { get; set; }
        public DateTime BusinessDate { get; set; }
        public string SourceTransactionId { get; set; } = string.Empty;
        public int LineNumber { get; set; }
        public string PosCode { get; set; } = string.Empty;
        public string? OutletName { get; set; }
        public Guid? MenuItemId { get; set; }
        public string? MenuItemName { get; set; }
        public Guid? RecipeId { get; set; }
        public decimal Quantity { get; set; }
        public string? Uom { get; set; }
        public decimal? Amount { get; set; }
        public string? Currency { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class SilaMenuPosMappingPageDto
    {
        public List<SilaMenuPosMappingDto> Items { get; set; } = new();
        public int Total { get; set; }
    }

    public class SilaMenuPosMappingDto
    {
        public Guid Id { get; set; }
        public string PosCode { get; set; } = string.Empty;
        public string? PosDescription { get; set; }
        public Guid? OutletLocationId { get; set; }
        public string? OutletName { get; set; }
        public Guid? MenuItemId { get; set; }
        public string? MenuItemName { get; set; }
        public Guid? SuggestedMenuItemId { get; set; }
        public string? SuggestedMenuItemName { get; set; }
        public decimal? SuggestionConfidence { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? MappingSource { get; set; }
        public DateTime? EffectiveFrom { get; set; }
        public DateTime? EffectiveTo { get; set; }
    }

    public class SilaMenuPosMappingWriteDto
    {
        public Guid? Id { get; set; }
        public string PosCode { get; set; } = string.Empty;
        public string? PosDescription { get; set; }
        public Guid? OutletLocationId { get; set; }
        public Guid MenuItemId { get; set; }
        public DateTime? EffectiveFrom { get; set; }
        public DateTime? EffectiveTo { get; set; }
    }

    public class SilaMenuPerformanceDto
    {
        public List<SilaMenuPerformanceRowDto> Rows { get; set; } = new();
        public int Stars { get; set; }
        public int Plowhorses { get; set; }
        public int Puzzles { get; set; }
        public int Dogs { get; set; }
    }

    public class SilaMenuPerformanceRowDto
    {
        public Guid MenuItemId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Category { get; set; }
        public decimal QtySold { get; set; }
        public decimal Revenue { get; set; }
        public decimal MixPercent { get; set; }
        public decimal? SellingPrice { get; set; }
        public decimal? CostPerPortion { get; set; }
        public decimal? FoodCostPercent { get; set; }
        public decimal? ContributionMargin { get; set; }
        public decimal? MarginPercent { get; set; }
        public decimal PopularityPercent { get; set; }
        public string Classification { get; set; } = "UNCLASSIFIED";
        public string CostState { get; set; } = "COST_PENDING";
    }

    public class SilaMenuConsumptionDto
    {
        public List<SilaMenuConsumptionRowDto> Rows { get; set; } = new();
        public decimal Theoretical { get; set; }
        public decimal Actual { get; set; }
        public decimal Variance { get; set; }
        public decimal? VarianceValue { get; set; }
    }

    public class SilaMenuConsumptionRowDto
    {
        public Guid? MenuItemId { get; set; }
        public Guid? RecipeId { get; set; }
        public Guid? MaterialId { get; set; }
        public string MenuItemName { get; set; } = string.Empty;
        public string RecipeName { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string Uom { get; set; } = string.Empty;
        public decimal TheoreticalQty { get; set; }
        public decimal ActualQty { get; set; }
        public decimal VarianceQty { get; set; }
        public decimal? VariancePercent { get; set; }
        public decimal? VarianceValue { get; set; }
        public string? OutletName { get; set; }
        public string? MealPeriod { get; set; }
    }

    public class SilaMenuCostMarginDto
    {
        public List<SilaMenuPerformanceRowDto> Rows { get; set; } = new();
        public List<SilaMenuInsightDto> CostDrivers { get; set; } = new();
    }

    public class SilaMenuRequirementDto
    {
        public List<SilaMenuRequirementRowDto> Rows { get; set; } = new();
        public decimal TotalShortage { get; set; }
    }

    public class SilaMenuRequirementRowDto
    {
        public Guid? MaterialId { get; set; }
        public string MaterialName { get; set; } = string.Empty;
        public string Uom { get; set; } = string.Empty;
        public decimal Requirement { get; set; }
        public decimal Available { get; set; }
        public decimal OpenPo { get; set; }
        public decimal NetRequirement { get; set; }
        public decimal Shortage { get; set; }
        public string? RelatedPlan { get; set; }
        public DateTime? RequiredDate { get; set; }
        public string Reason { get; set; } = "MENU_PLAN";
    }

    public class SilaMenuRecommendationDto
    {
        public List<SilaMenuRequirementRowDto> MenuDemand { get; set; } = new();
        public SilaPurchaseRecommendationListDto Existing { get; set; } = new();
    }

    public class SilaMenuInsightDto
    {
        public string Category { get; set; } = string.Empty;
        public string Priority { get; set; } = "ACTION";
        public string Title { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public string? RecommendedAction { get; set; }
        public string? AffectedName { get; set; }
        public Guid? MenuItemId { get; set; }
        public Guid? MaterialId { get; set; }
        public Guid? OutletLocationId { get; set; }
    }

    public class SilaMenuIntelligenceDto
    {
        public List<SilaMenuInsightDto> Insights { get; set; } = new();
    }

    public class SilaMenuWhatIfRequestDto
    {
        public Guid? MenuPlanId { get; set; }
        public decimal? OccupancyPercent { get; set; }
        public decimal? ExpectedCovers { get; set; }
        public decimal? PortionFactor { get; set; }
        public decimal? PriceFactor { get; set; }
        public decimal? CostFactor { get; set; }
        public Guid? AddMenuItemId { get; set; }
        public Guid? RemoveMenuItemId { get; set; }
        public decimal? MealParticipation { get; set; }
    }

    public class SilaMenuWhatIfResultDto
    {
        public decimal RecommendedPortions { get; set; }
        public decimal PlannedPortions { get; set; }
        public decimal IngredientRequirement { get; set; }
        public decimal Shortage { get; set; }
        public decimal PurchaseRequirement { get; set; }
        public decimal FoodCost { get; set; }
        public decimal Revenue { get; set; }
        public decimal ContributionMargin { get; set; }
        public decimal? MarginPercent { get; set; }
        public string Note { get; set; } = "Simulation is not saved to operational data.";
    }

    public class SilaMenuEngineeringSettingsDto
    {
        public decimal DefaultMealParticipation { get; set; }
        public decimal DefaultItemParticipation { get; set; }
        public decimal DefaultBufferPercentage { get; set; }
        public decimal DefaultAdultFactor { get; set; }
        public decimal DefaultChildFactor { get; set; }
        public decimal PopularityThreshold { get; set; }
        public decimal HighFoodCostPercent { get; set; }
        public int StaleHours { get; set; }
        public List<string> MealPeriods { get; set; } = new();
        public List<string> Categories { get; set; } = new();
        public string? PmsProvider { get; set; }
        public string? PmsConnectionName { get; set; }
        public string? PosConnectionName { get; set; }
        public string? AiNotes { get; set; }
    }

    public class SilaMenuEngineeringSaveDto
    {
        public string Action { get; set; } = string.Empty;
        public SilaMenuItemWriteDto? Item { get; set; }
        public SilaMenuPlanWriteDto? Plan { get; set; }
        public SilaPmsDemandWriteDto? Demand { get; set; }
        public SilaMenuPosMappingWriteDto? Mapping { get; set; }
        public SilaMenuEngineeringSettingsDto? Settings { get; set; }
        public SilaMenuWhatIfRequestDto? Simulation { get; set; }
        public Guid? MenuItemId { get; set; }
        public Guid? RecipeId { get; set; }
        public Guid? MenuPlanId { get; set; }
        public string? RecipeLinkStatus { get; set; }
        public string? Csv { get; set; }
    }
}
