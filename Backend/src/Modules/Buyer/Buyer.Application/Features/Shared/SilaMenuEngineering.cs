using System.Globalization;
using System.Text.Json;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Menu Engineering: Menu Item is the selling object; Recipe remains production/cost authority.
    /// Reuses inventory ledger, open PO coverage, purchase recommendations, POS sales, and recipe ingredients.
    /// </summary>
    public static class SilaMenuEngineering
    {
        public const string MODULE = "MENU_ENGINEERING";
        private static readonly string[] DefaultMeals = ["Breakfast", "Lunch", "Dinner", "Snacks", "Buffet", "Banquet", "Room Service", "Staff Meals", "Seasonal Menu", "Special Menu", "Other"];

        public static async Task<SilaMenuEngineeringEnvelopeDto> LoadAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid organizationId,
            Guid userId,
            Guid roleId,
            string view,
            SilaMenuEngineeringFilterDto filter,
            SilaMenuWhatIfRequestDto? simulation,
            CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(repository, logger, organizationId);
            MenuContext ctx = await ContextAsync(repository, buyer, userId, roleId, filter, cancellationToken);
            SilaMenuEngineeringEnvelopeDto envelope = new() { View = view };
            string key = (view ?? "dashboard").Trim().ToLowerInvariant();
            envelope.Lookups = await LookupsAsync(repository, ctx, cancellationToken);
            switch (key)
            {
                case "item":
                    envelope.Item = filter.MenuItemId == null ? null : await ItemAsync(repository, ctx, filter.MenuItemId.Value, cancellationToken);
                    break;
                case "items":
                    envelope.Items = await ItemsAsync(repository, ctx, filter, cancellationToken);
                    break;
                case "plan":
                    envelope.Plan = filter.MenuPlanId == null ? null : await PlanAsync(repository, ctx, filter.MenuPlanId.Value, cancellationToken);
                    break;
                case "plans":
                case "portions":
                    envelope.Plans = await PlansAsync(repository, ctx, filter, cancellationToken);
                    envelope.Items = await ItemsAsync(repository, ctx, filter, cancellationToken);
                    if (filter.MenuPlanId != null) envelope.Plan = await PlanAsync(repository, ctx, filter.MenuPlanId.Value, cancellationToken);
                    break;
                case "demand":
                case "pms":
                    envelope.Demand = await DemandAsync(repository, ctx, filter, cancellationToken);
                    break;
                case "pos-sales":
                    envelope.PosSales = await PosSalesAsync(repository, ctx, filter, cancellationToken);
                    break;
                case "pos-mappings":
                    envelope.PosMappings = await MappingsAsync(repository, ctx, filter, cancellationToken);
                    envelope.Items = await ItemsAsync(repository, ctx, filter, cancellationToken);
                    break;
                case "performance":
                    envelope.Performance = await PerformanceAsync(repository, ctx, filter, cancellationToken);
                    break;
                case "consumption":
                    envelope.Consumption = await ConsumptionAsync(repository, ctx, filter, cancellationToken);
                    break;
                case "cost":
                    envelope.CostMargin = new SilaMenuCostMarginDto
                    {
                        Rows = (await PerformanceAsync(repository, ctx, filter, cancellationToken)).Rows,
                        CostDrivers = Insights(await PerformanceAsync(repository, ctx, filter, cancellationToken), await ConsumptionAsync(repository, ctx, filter, cancellationToken), await RequirementsAsync(repository, ctx, filter, cancellationToken), ctx.Settings).Where(x => x.Category == "COST").ToList()
                    };
                    break;
                case "requirements":
                    envelope.Requirements = await RequirementsAsync(repository, ctx, filter, cancellationToken);
                    break;
                case "recommendations":
                    envelope.Recommendations = await RecommendationsAsync(repository, ctx, filter, cancellationToken);
                    break;
                case "intelligence":
                    envelope.Intelligence = new SilaMenuIntelligenceDto { Insights = Insights(await PerformanceAsync(repository, ctx, filter, cancellationToken), await ConsumptionAsync(repository, ctx, filter, cancellationToken), await RequirementsAsync(repository, ctx, filter, cancellationToken), ctx.Settings) };
                    break;
                case "simulate":
                    envelope.Simulation = await SimulateAsync(repository, ctx, simulation ?? new SilaMenuWhatIfRequestDto(), cancellationToken);
                    break;
                case "settings":
                    envelope.Settings = ToSettings(ctx.Settings);
                    break;
                default:
                    envelope.Dashboard = await DashboardAsync(repository, ctx, filter, cancellationToken);
                    break;
            }
            return envelope;
        }

        public static async Task<SilaMenuEngineeringEnvelopeDto> SaveAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid organizationId,
            Guid userId,
            Guid roleId,
            SilaMenuEngineeringSaveDto request,
            CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(repository, logger, organizationId);
            MenuContext ctx = await ContextAsync(repository, buyer, userId, roleId, new SilaMenuEngineeringFilterDto(), cancellationToken);
            string action = (request.Action ?? "").Trim().ToUpperInvariant();
            Guid? saved = null;
            string? message = null;
            switch (action)
            {
                case "UPSERT_ITEM":
                    saved = await UpsertItemAsync(repository, ctx, userId, request.Item ?? throw Required("Menu item"), cancellationToken);
                    message = "Menu item saved.";
                    break;
                case "LINK_RECIPE":
                    saved = await LinkRecipeAsync(repository, ctx, userId, request.MenuItemId, request.RecipeId, request.RecipeLinkStatus ?? "RECIPE_LINKED", cancellationToken);
                    message = "Recipe linked.";
                    break;
                case "UNLINK_RECIPE":
                    saved = await LinkRecipeAsync(repository, ctx, userId, request.MenuItemId, null, "MENU_ITEM_ONLY", cancellationToken);
                    message = "Recipe unlinked.";
                    break;
                case "CREATE_RECIPE":
                    saved = await CreateRecipeFromItemAsync(repository, logger, ctx, userId, roleId, request.MenuItemId, cancellationToken);
                    message = "Draft recipe created from the menu item. Complete ingredients in Recipe Management.";
                    break;
                case "UPSERT_PLAN":
                    saved = await UpsertPlanAsync(repository, ctx, userId, request.Plan ?? throw Required("Menu plan"), cancellationToken);
                    message = "Menu plan saved.";
                    break;
                case "COPY_PLAN":
                    saved = await CopyPlanAsync(repository, ctx, userId, request.MenuPlanId, request.Plan, cancellationToken);
                    message = "Menu plan copied.";
                    break;
                case "CONFIRM_PLAN":
                    saved = await ConfirmPlanAsync(repository, ctx, userId, request.MenuPlanId, cancellationToken);
                    message = "Menu plan confirmed.";
                    break;
                case "SAVE_PMS":
                    saved = await SavePmsAsync(repository, ctx, userId, request.Demand ?? throw Required("Demand"), cancellationToken);
                    message = "Manual demand saved.";
                    break;
                case "PULL_PMS":
                    saved = await PullPmsAsync(repository, ctx, userId, request.Demand, cancellationToken);
                    message = "PMS adapter recorded availability. No occupancy values were invented.";
                    break;
                case "UPSERT_MAPPING":
                    saved = await UpsertMappingAsync(repository, ctx, userId, request.Mapping ?? throw Required("POS mapping"), cancellationToken);
                    message = "POS mapping saved.";
                    break;
                case "IMPORT_POS":
                    int imported = await ImportPosAsync(repository, ctx, userId, request.Csv ?? "", cancellationToken);
                    message = imported == 0 ? "No new POS lines were imported. Duplicates are ignored." : $"{imported} POS line(s) imported.";
                    break;
                case "SAVE_SETTINGS":
                    saved = await SaveSettingsAsync(repository, ctx, userId, request.Settings ?? throw Required("Settings"), cancellationToken);
                    message = "Menu Engineering setup saved.";
                    break;
                case "SIMULATE":
                    return new SilaMenuEngineeringEnvelopeDto { View = "simulate", Simulation = await SimulateAsync(repository, ctx, request.Simulation ?? new SilaMenuWhatIfRequestDto(), cancellationToken) };
                default:
                    throw new BadRequestCustomException("Unknown Menu Engineering action.", "Choose a supported Menu Engineering action.");
            }

            new InventoryLedger(repository, ctx.Buyer.Id, userId).AddEvent(MODULE, saved ?? Guid.Empty, action, null);
            await repository.SaveAsync();
            return new SilaMenuEngineeringEnvelopeDto { View = action.ToLowerInvariant(), SavedId = saved, Message = message };
        }

        private sealed class MenuContext
        {
            public required BuyerBusinessProfile Buyer { get; init; }
            public required List<InventoryLocation> Scope { get; init; }
            public required List<Guid> ScopeIds { get; init; }
            public required MenuEngineeringSettings Settings { get; set; }
            public required Dictionary<Guid, BuyerProperty> Properties { get; init; }
        }

        private static async Task<MenuContext> ContextAsync(IRepositoryWrapper repository, BuyerBusinessProfile buyer, Guid userId, Guid roleId, SilaMenuEngineeringFilterDto filter, CancellationToken cancellationToken)
        {
            List<Guid> mine = await SilaAccess.GetLocationIdsAsync(repository, buyer.Id, userId, roleId, cancellationToken);
            List<InventoryLocation> scope = mine.Count == 0
                ? new List<InventoryLocation>()
                : await repository.InventoryLocation.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && mine.Contains(x.Id)).ToListAsync(cancellationToken);
            if (filter.OutletLocationId is Guid outlet && outlet != Guid.Empty)
                scope = scope.Where(x => x.Id == outlet || x.ParentLocationId == outlet).ToList();
            if (filter.PropertyId is Guid property && property != Guid.Empty)
                scope = scope.Where(x => x.PropertyId == property).ToList();
            MenuEngineeringSettings settings = await repository.MenuEngineeringSettings.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                ?? new MenuEngineeringSettings { Id = Guid.NewGuid(), BuyerId = buyer.Id, IsActive = true };
            List<Guid> propertyIds = scope.Select(x => x.PropertyId).Distinct().ToList();
            Dictionary<Guid, BuyerProperty> properties = propertyIds.Count == 0
                ? new Dictionary<Guid, BuyerProperty>()
                : await repository.BuyerProperty.FindByCondition(x => propertyIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            return new MenuContext { Buyer = buyer, Scope = scope, ScopeIds = scope.Select(x => x.Id).ToList(), Settings = settings, Properties = properties };
        }

        private static async Task<SilaMenuLookupsDto> LookupsAsync(IRepositoryWrapper repository, MenuContext ctx, CancellationToken cancellationToken)
        {
            List<Recipe> recipes = await repository.Recipe.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive).OrderBy(x => x.Name).Take(400).ToListAsync(cancellationToken);
            return new SilaMenuLookupsDto
            {
                Properties = ctx.Properties.Values.Select(x => new SilaMenuNamedRefDto { Id = x.Id, Name = x.PropertyName, Code = x.PlantCode }).ToList(),
                Outlets = ctx.Scope.Where(x => x.LocationType != Common.SILA_LOCATION_VENUE).Select(x => new SilaMenuNamedRefDto { Id = x.Id, Name = x.LocationName, Code = x.LocationCode, PropertyId = x.PropertyId }).ToList(),
                MealPeriods = ReadList(ctx.Settings.MealPeriodsJson, DefaultMeals),
                Categories = ReadList(ctx.Settings.CategoriesJson, ["Food", "Beverage"]),
                Recipes = recipes.Select(x => new SilaMenuNamedRefDto { Id = x.Id, Name = x.Name, Code = x.RecipeCode }).ToList()
            };
        }

        private static async Task<SilaMenuItemPageDto> ItemsAsync(IRepositoryWrapper repository, MenuContext ctx, SilaMenuEngineeringFilterDto filter, CancellationToken cancellationToken)
        {
            IQueryable<MenuItem> query = repository.MenuItem.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive);
            if (!string.IsNullOrWhiteSpace(filter.Status)) query = query.Where(x => x.Status == filter.Status);
            if (!string.IsNullOrWhiteSpace(filter.Category)) query = query.Where(x => x.Category == filter.Category);
            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                string term = filter.Search.Trim();
                query = query.Where(x => x.Name.Contains(term) || x.MenuItemCode.Contains(term));
            }
            if (filter.OutletLocationId != null) query = query.Where(x => x.OutletLocationId == filter.OutletLocationId || x.OutletLocationId == null);
            int total = await query.CountAsync(cancellationToken);
            int limit = Math.Clamp(filter.Limit <= 0 ? 50 : filter.Limit, 1, 200);
            List<MenuItem> rows = await query.OrderBy(x => x.Name).Skip(filter.Index * limit).Take(limit).ToListAsync(cancellationToken);
            Dictionary<Guid, Recipe> recipes = await RecipesOfAsync(repository, ctx.Buyer.Id, rows.Where(x => x.LinkedRecipeId != null).Select(x => x.LinkedRecipeId!.Value), cancellationToken);
            return new SilaMenuItemPageDto
            {
                Total = total,
                Index = filter.Index,
                Limit = limit,
                Items = rows.Select(x => ToItem(x, x.LinkedRecipeId != null && recipes.TryGetValue(x.LinkedRecipeId.Value, out Recipe? recipe) ? recipe : null)).ToList()
            };
        }

        private static async Task<SilaMenuItemDetailDto> ItemAsync(IRepositoryWrapper repository, MenuContext ctx, Guid id, CancellationToken cancellationToken)
        {
            MenuItem item = await repository.MenuItem.FindByCondition(x => x.Id == id && x.BuyerId == ctx.Buyer.Id && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundCustomException("Menu item not found.", "Select a menu item of this organization.");
            Recipe? recipe = item.LinkedRecipeId == null ? null : await repository.Recipe.FindByCondition(x => x.Id == item.LinkedRecipeId && x.BuyerId == ctx.Buyer.Id).FirstOrDefaultAsync(cancellationToken);
            return ToItem(item, recipe);
        }

        private static SilaMenuItemDetailDto ToItem(MenuItem item, Recipe? recipe)
        {
            decimal? cost = recipe is { TotalCost: > 0, ServingQty: > 0 } ? recipe.TotalCost / recipe.ServingQty : recipe is { TotalCost: > 0 } ? recipe.TotalCost : null;
            decimal? margin = item.SellingPrice != null && cost != null ? item.SellingPrice - cost : null;
            string costState = recipe == null ? "RECIPE_REQUIRED" : cost == null ? "COST_PENDING" : "READY";
            return new SilaMenuItemDetailDto
            {
                Id = item.Id,
                MenuItemCode = item.MenuItemCode,
                Name = item.Name,
                Description = item.Description,
                Category = item.Category,
                SubCategory = item.SubCategory,
                Cuisine = item.Cuisine,
                Classification = item.Classification,
                MealPeriods = item.MealPeriods,
                SellingPrice = item.SellingPrice,
                Currency = item.Currency,
                DefaultPortionQty = item.DefaultPortionQty,
                PortionUom = item.PortionUom,
                AdultPortionFactor = item.AdultPortionFactor,
                ChildPortionFactor = item.ChildPortionFactor,
                DefaultParticipationRate = item.DefaultParticipationRate,
                DefaultBufferPercentage = item.DefaultBufferPercentage,
                ServiceType = item.ServiceType,
                DietaryTags = item.DietaryTags,
                AllergenNotes = item.AllergenNotes,
                ImagePath = item.ImagePath,
                PropertyId = item.PropertyId,
                OutletLocationId = item.OutletLocationId,
                EffectiveFrom = item.EffectiveFrom,
                EffectiveTo = item.EffectiveTo,
                Status = item.Status,
                LinkedRecipeId = item.LinkedRecipeId,
                RecipeLinkStatus = item.RecipeLinkStatus,
                RecipeName = recipe?.Name ?? "",
                RecipeStatus = recipe?.Status ?? "",
                RecipeCost = cost,
                FoodCostPercent = item.SellingPrice is > 0 && cost != null ? cost / item.SellingPrice : null,
                ContributionMargin = margin,
                CostState = costState,
                CreatedAt = item.DateCreated,
                UpdatedAt = item.DateUpdated
            };
        }

        private static async Task<Guid> UpsertItemAsync(IRepositoryWrapper repository, MenuContext ctx, Guid userId, SilaMenuItemWriteDto dto, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(dto.Name)) throw new BadRequestCustomException("Name is required.", "Enter the menu item name.");
            MenuItem item;
            if (dto.Id is Guid id && id != Guid.Empty)
            {
                item = await repository.MenuItem.FindByCondition(x => x.Id == id && x.BuyerId == ctx.Buyer.Id && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                    ?? throw new NotFoundCustomException("Menu item not found.", "Select a menu item of this organization.");
            }
            else
            {
                item = new MenuItem
                {
                    Id = Guid.NewGuid(),
                    BuyerId = ctx.Buyer.Id,
                    MenuItemCode = await DocumentNumber.NextAsync(repository, ctx.Buyer.Id, DocumentNumber.MENU_ITEM, 6, cancellationToken),
                    Status = "DRAFT",
                    RecipeLinkStatus = "MENU_ITEM_ONLY",
                    IsActive = true
                };
                repository.MenuItem.Create(item);
            }
            ApplyItem(item, dto);
            if (dto.LinkedRecipeId != null)
            {
                await EnsureRecipeAsync(repository, ctx.Buyer.Id, dto.LinkedRecipeId.Value, cancellationToken);
                item.LinkedRecipeId = dto.LinkedRecipeId;
                item.RecipeLinkStatus = string.IsNullOrWhiteSpace(dto.RecipeLinkStatus) ? "RECIPE_LINKED" : dto.RecipeLinkStatus!;
            }
            return item.Id;
        }

        private static void ApplyItem(MenuItem item, SilaMenuItemWriteDto dto)
        {
            item.Name = dto.Name.Trim();
            item.Description = dto.Description;
            item.Category = dto.Category;
            item.SubCategory = dto.SubCategory;
            item.Cuisine = dto.Cuisine;
            item.Classification = dto.Classification;
            item.MealPeriods = dto.MealPeriods;
            item.SellingPrice = dto.SellingPrice;
            item.Currency = dto.Currency;
            item.DefaultPortionQty = dto.DefaultPortionQty <= 0 ? 1 : dto.DefaultPortionQty;
            item.PortionUom = string.IsNullOrWhiteSpace(dto.PortionUom) ? "EA" : dto.PortionUom;
            item.AdultPortionFactor = dto.AdultPortionFactor;
            item.ChildPortionFactor = dto.ChildPortionFactor;
            item.DefaultParticipationRate = dto.DefaultParticipationRate;
            item.DefaultBufferPercentage = dto.DefaultBufferPercentage;
            item.ServiceType = dto.ServiceType;
            item.DietaryTags = dto.DietaryTags;
            item.AllergenNotes = dto.AllergenNotes;
            item.ImagePath = dto.ImagePath;
            item.PropertyId = dto.PropertyId;
            item.OutletLocationId = dto.OutletLocationId;
            item.EffectiveFrom = dto.EffectiveFrom;
            item.EffectiveTo = dto.EffectiveTo;
            if (!string.IsNullOrWhiteSpace(dto.Status)) item.Status = dto.Status.Trim().ToUpperInvariant();
        }

        private static async Task<Guid> LinkRecipeAsync(IRepositoryWrapper repository, MenuContext ctx, Guid userId, Guid? menuItemId, Guid? recipeId, string linkStatus, CancellationToken cancellationToken)
        {
            if (menuItemId == null || menuItemId == Guid.Empty) throw Required("Menu item");
            MenuItem item = await repository.MenuItem.FindByCondition(x => x.Id == menuItemId && x.BuyerId == ctx.Buyer.Id && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundCustomException("Menu item not found.", "Select a menu item of this organization.");
            if (recipeId != null)
            {
                Recipe recipe = await EnsureRecipeAsync(repository, ctx.Buyer.Id, recipeId.Value, cancellationToken);
                if (item.DefaultPortionQty <= 0 && recipe.ServingQty > 0) item.DefaultPortionQty = recipe.ServingQty;
                if (string.IsNullOrWhiteSpace(item.PortionUom)) item.PortionUom = recipe.ServingUom;
            }
            item.LinkedRecipeId = recipeId;
            item.RecipeLinkStatus = recipeId == null ? "MENU_ITEM_ONLY" : linkStatus;
            return item.Id;
        }

        private static async Task<Guid> CreateRecipeFromItemAsync(IRepositoryWrapper repository, ILoggerManager logger, MenuContext ctx, Guid userId, Guid roleId, Guid? menuItemId, CancellationToken cancellationToken)
        {
            if (menuItemId == null) throw Required("Menu item");
            MenuItem item = await repository.MenuItem.FindByCondition(x => x.Id == menuItemId && x.BuyerId == ctx.Buyer.Id && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundCustomException("Menu item not found.", "Select a menu item of this organization.");
            if (item.LinkedRecipeId != null) return item.LinkedRecipeId.Value;
            string recipeCode = await DocumentNumber.NextAsync(repository, ctx.Buyer.Id, DocumentNumber.RECIPE, 8, cancellationToken);
            Recipe recipe = new Recipe
            {
                Id = Guid.NewGuid(),
                BuyerId = ctx.Buyer.Id,
                RecipeCode = recipeCode,
                Name = item.Name,
                Description = item.Description,
                Category = item.Category,
                ItemMode = Common.SILA_RECIPE_RECIPE,
                ServingQty = item.DefaultPortionQty <= 0 ? 1 : item.DefaultPortionQty,
                ServingUom = string.IsNullOrWhiteSpace(item.PortionUom) ? "EA" : item.PortionUom!,
                SellingUom = string.IsNullOrWhiteSpace(item.PortionUom) ? "EA" : item.PortionUom!,
                Currency = item.Currency,
                Status = Common.SILA_RECIPE_DRAFT,
                Version = 1,
                ActiveVersion = 0,
                IsActive = true
            };
            repository.Recipe.Create(recipe);
            item.LinkedRecipeId = recipe.Id;
            item.RecipeLinkStatus = "CONVERTED_TO_RECIPE";
            return recipe.Id;
        }

        private static async Task<Recipe> EnsureRecipeAsync(IRepositoryWrapper repository, Guid buyerId, Guid recipeId, CancellationToken cancellationToken)
        {
            return await repository.Recipe.FindByCondition(x => x.Id == recipeId && x.BuyerId == buyerId && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundCustomException("Recipe not found.", "Select an existing recipe from Recipe Management.");
        }

        private static async Task<SilaMenuPlanPageDto> PlansAsync(IRepositoryWrapper repository, MenuContext ctx, SilaMenuEngineeringFilterDto filter, CancellationToken cancellationToken)
        {
            DateTime from = (filter.DateFrom ?? DateTime.UtcNow.Date).Date;
            DateTime to = (filter.DateTo ?? from.AddDays(7)).Date;
            IQueryable<MenuPlan> query = repository.MenuPlan.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive && x.BusinessDate >= from && x.BusinessDate <= to);
            if (!string.IsNullOrWhiteSpace(filter.MealPeriod)) query = query.Where(x => x.MealPeriod == filter.MealPeriod);
            if (filter.OutletLocationId != null) query = query.Where(x => x.OutletLocationId == filter.OutletLocationId);
            if (filter.PropertyId != null) query = query.Where(x => x.PropertyId == filter.PropertyId);
            List<MenuPlan> plans = await query.OrderBy(x => x.BusinessDate).ThenBy(x => x.MealPeriod).ToListAsync(cancellationToken);
            List<Guid> ids = plans.Select(x => x.Id).ToList();
            List<MenuPlanLine> lines = ids.Count == 0 ? new() : await repository.MenuPlanLine.FindByCondition(x => ids.Contains(x.MenuPlanId) && x.IsActive).ToListAsync(cancellationToken);
            List<Guid> itemIds = lines.Select(x => x.MenuItemId).Distinct().ToList();
            Dictionary<Guid, MenuItem> items = itemIds.Count == 0 ? new() : await repository.MenuItem.FindByCondition(x => itemIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            return new SilaMenuPlanPageDto
            {
                Total = plans.Count,
                Items = plans.Select(plan =>
                {
                    List<MenuPlanLine> planLines = lines.Where(x => x.MenuPlanId == plan.Id).ToList();
                    return new SilaMenuPlanSummaryDto
                    {
                        Id = plan.Id,
                        PlanCode = plan.PlanCode,
                        Name = plan.Name,
                        PropertyName = plan.PropertyId != null && ctx.Properties.TryGetValue(plan.PropertyId.Value, out BuyerProperty? property) ? property.PropertyName : null,
                        OutletName = ctx.Scope.FirstOrDefault(x => x.Id == plan.OutletLocationId)?.LocationName,
                        BusinessDate = plan.BusinessDate,
                        MealPeriod = plan.MealPeriod,
                        ExpectedGuests = plan.ExpectedGuests,
                        ExpectedCovers = plan.ExpectedCovers,
                        Status = plan.Status,
                        LineCount = planLines.Count,
                        MissingRecipes = planLines.Count(x => !items.TryGetValue(x.MenuItemId, out MenuItem? item) || item.LinkedRecipeId == null)
                    };
                }).ToList()
            };
        }

        private static async Task<SilaMenuPlanDetailDto> PlanAsync(IRepositoryWrapper repository, MenuContext ctx, Guid id, CancellationToken cancellationToken)
        {
            MenuPlan plan = await repository.MenuPlan.FindByCondition(x => x.Id == id && x.BuyerId == ctx.Buyer.Id && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundCustomException("Menu plan not found.", "Select a menu plan of this organization.");
            List<MenuPlanLine> lines = await repository.MenuPlanLine.FindByCondition(x => x.MenuPlanId == plan.Id && x.IsActive).ToListAsync(cancellationToken);
            Dictionary<Guid, MenuItem> items = await ItemsOfAsync(repository, ctx.Buyer.Id, lines.Select(x => x.MenuItemId), cancellationToken);
            Dictionary<Guid, decimal> actuals = await ActualPortionsAsync(repository, ctx, items.Values, plan, cancellationToken);
            return ToPlan(plan, lines, items, ctx, actuals);
        }

        private static SilaMenuPlanDetailDto ToPlan(MenuPlan plan, List<MenuPlanLine> lines, Dictionary<Guid, MenuItem> items, MenuContext ctx, Dictionary<Guid, decimal> actuals)
        {
            return new SilaMenuPlanDetailDto
            {
                Id = plan.Id,
                PlanCode = plan.PlanCode,
                Name = plan.Name,
                PropertyId = plan.PropertyId,
                OutletLocationId = plan.OutletLocationId,
                PropertyName = plan.PropertyId != null && ctx.Properties.TryGetValue(plan.PropertyId.Value, out BuyerProperty? property) ? property.PropertyName : null,
                OutletName = ctx.Scope.FirstOrDefault(x => x.Id == plan.OutletLocationId)?.LocationName,
                BusinessDate = plan.BusinessDate,
                StartDate = plan.StartDate,
                EndDate = plan.EndDate,
                MealPeriod = plan.MealPeriod,
                EventName = plan.EventName,
                ExpectedGuests = plan.ExpectedGuests,
                ExpectedCovers = plan.ExpectedCovers,
                MealParticipation = plan.MealParticipation,
                Status = plan.Status,
                Notes = plan.Notes,
                Lines = lines.Select(line =>
                {
                    items.TryGetValue(line.MenuItemId, out MenuItem? item);
                    decimal recommended = RecommendedPortions(plan, line, item, ctx.Settings);
                    actuals.TryGetValue(line.MenuItemId, out decimal actual);
                    return new SilaMenuPlanLineDto
                    {
                        Id = line.Id,
                        MenuItemId = line.MenuItemId,
                        MenuItemName = item?.Name ?? "",
                        MenuItemCode = item?.MenuItemCode ?? "",
                        RecipeLinkStatus = item?.RecipeLinkStatus ?? "MENU_ITEM_ONLY",
                        ParticipationRate = line.ParticipationRate,
                        BufferPercentage = line.BufferPercentage,
                        AdultFactor = line.AdultFactor,
                        ChildFactor = line.ChildFactor,
                        RecommendedPortions = recommended,
                        PlannedPortions = line.PlannedPortions,
                        ConfirmPortions = line.PortionsConfirmed,
                        PortionsConfirmed = line.PortionsConfirmed,
                        OverrideReason = line.OverrideReason,
                        ActualPortions = actual == 0 ? null : actual,
                        Variance = line.PlannedPortions == null ? null : actual - line.PlannedPortions,
                        Warning = item?.LinkedRecipeId == null ? "Recipe required before ingredient demand can be calculated." : line.Warning
                    };
                }).ToList()
            };
        }

        private static decimal RecommendedPortions(MenuPlan plan, MenuPlanLine line, MenuItem? item, MenuEngineeringSettings settings)
        {
            decimal guests = plan.ExpectedCovers ?? plan.ExpectedGuests ?? 0;
            decimal meal = plan.MealParticipation ?? settings.DefaultMealParticipation;
            decimal participation = line.ParticipationRate ?? item?.DefaultParticipationRate ?? settings.DefaultItemParticipation;
            decimal factor = line.AdultFactor ?? item?.AdultPortionFactor ?? settings.DefaultAdultFactor;
            decimal buffer = 1 + (line.BufferPercentage ?? item?.DefaultBufferPercentage ?? settings.DefaultBufferPercentage);
            return Math.Round(Math.Max(0, guests * meal * participation * factor * buffer), 2);
        }

        private static async Task<Guid> UpsertPlanAsync(IRepositoryWrapper repository, MenuContext ctx, Guid userId, SilaMenuPlanWriteDto dto, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(dto.Name)) throw new BadRequestCustomException("Name is required.", "Enter the menu plan name.");
            MenuPlan plan;
            if (dto.Id is Guid id && id != Guid.Empty)
            {
                plan = await repository.MenuPlan.FindByCondition(x => x.Id == id && x.BuyerId == ctx.Buyer.Id && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                    ?? throw new NotFoundCustomException("Menu plan not found.", "Select a menu plan of this organization.");
            }
            else
            {
                plan = new MenuPlan
                {
                    Id = Guid.NewGuid(),
                    BuyerId = ctx.Buyer.Id,
                    PlanCode = await DocumentNumber.NextAsync(repository, ctx.Buyer.Id, DocumentNumber.MENU_PLAN, 6, cancellationToken),
                    Status = "DRAFT",
                    IsActive = true
                };
                repository.MenuPlan.Create(plan);
            }
            plan.Name = dto.Name.Trim();
            plan.PropertyId = dto.PropertyId;
            plan.OutletLocationId = dto.OutletLocationId;
            plan.BusinessDate = dto.BusinessDate == default ? DateTime.UtcNow.Date : dto.BusinessDate.Date;
            plan.StartDate = dto.StartDate;
            plan.EndDate = dto.EndDate;
            plan.MealPeriod = dto.MealPeriod;
            plan.EventName = dto.EventName;
            plan.ExpectedGuests = dto.ExpectedGuests;
            plan.ExpectedCovers = dto.ExpectedCovers ?? dto.ExpectedGuests;
            plan.MealParticipation = dto.MealParticipation;
            plan.Notes = dto.Notes;
            if (!string.IsNullOrWhiteSpace(dto.Status)) plan.Status = dto.Status.Trim().ToUpperInvariant();
            List<MenuPlanLine> existing = await repository.MenuPlanLine.FindByCondition(x => x.MenuPlanId == plan.Id && x.IsActive).ToListAsync(cancellationToken);
            HashSet<Guid> keep = new();
            Dictionary<Guid, MenuItem> items = await ItemsOfAsync(repository, ctx.Buyer.Id, dto.Lines.Select(x => x.MenuItemId), cancellationToken);
            foreach (SilaMenuPlanLineWriteDto write in dto.Lines)
            {
                if (!items.ContainsKey(write.MenuItemId)) throw new BadRequestCustomException("Unknown menu item.", "Add an existing menu item. Do not invent menu items.");
                MenuPlanLine line = existing.FirstOrDefault(x => x.Id == write.Id) ?? existing.FirstOrDefault(x => x.MenuItemId == write.MenuItemId && !keep.Contains(x.Id)) ?? new MenuPlanLine { Id = Guid.NewGuid(), MenuPlanId = plan.Id, MenuItemId = write.MenuItemId, IsActive = true };
                if (existing.All(x => x.Id != line.Id)) repository.MenuPlanLine.Create(line);
                line.MenuItemId = write.MenuItemId;
                line.ParticipationRate = write.ParticipationRate;
                line.BufferPercentage = write.BufferPercentage;
                line.AdultFactor = write.AdultFactor;
                line.ChildFactor = write.ChildFactor;
                decimal recommended = RecommendedPortions(plan, line, items[write.MenuItemId], ctx.Settings);
                line.RecommendedPortions = recommended;
                if (write.ConfirmPortions == true || line.PortionsConfirmed)
                {
                    if (write.PlannedPortions != null && write.PlannedPortions != line.PlannedPortions)
                    {
                        line.OverrideReason = write.OverrideReason;
                    }
                    if (write.PlannedPortions != null) line.PlannedPortions = write.PlannedPortions;
                    line.PortionsConfirmed = true;
                }
                else
                {
                    line.PlannedPortions = write.PlannedPortions ?? recommended;
                    line.OverrideReason = write.OverrideReason;
                    if (write.ConfirmPortions == true) line.PortionsConfirmed = true;
                }
                keep.Add(line.Id);
            }
            foreach (MenuPlanLine drop in existing.Where(x => !keep.Contains(x.Id))) drop.IsActive = false;
            return plan.Id;
        }

        private static async Task<Guid> CopyPlanAsync(IRepositoryWrapper repository, MenuContext ctx, Guid userId, Guid? sourceId, SilaMenuPlanWriteDto? dto, CancellationToken cancellationToken)
        {
            if (sourceId == null) throw Required("Source menu plan");
            SilaMenuPlanDetailDto source = await PlanAsync(repository, ctx, sourceId.Value, cancellationToken);
            SilaMenuPlanWriteDto write = new()
            {
                Name = dto?.Name ?? $"{source.Name} copy",
                PropertyId = dto?.PropertyId ?? source.PropertyId,
                OutletLocationId = dto?.OutletLocationId ?? source.OutletLocationId,
                BusinessDate = dto?.BusinessDate == default || dto == null ? source.BusinessDate.AddDays(1) : dto.BusinessDate,
                MealPeriod = dto?.MealPeriod ?? source.MealPeriod,
                ExpectedGuests = dto?.ExpectedGuests ?? source.ExpectedGuests,
                ExpectedCovers = dto?.ExpectedCovers ?? source.ExpectedCovers,
                MealParticipation = dto?.MealParticipation ?? source.MealParticipation,
                Lines = source.Lines.Select(x => new SilaMenuPlanLineWriteDto
                {
                    MenuItemId = x.MenuItemId,
                    ParticipationRate = x.ParticipationRate,
                    BufferPercentage = x.BufferPercentage,
                    AdultFactor = x.AdultFactor,
                    ChildFactor = x.ChildFactor,
                    PlannedPortions = x.PlannedPortions
                }).ToList()
            };
            Guid id = await UpsertPlanAsync(repository, ctx, userId, write, cancellationToken);
            MenuPlan plan = await repository.MenuPlan.FindByCondition(x => x.Id == id).FirstAsync(cancellationToken);
            plan.CopiedFromPlanId = sourceId;
            return id;
        }

        private static async Task<Guid> ConfirmPlanAsync(IRepositoryWrapper repository, MenuContext ctx, Guid userId, Guid? planId, CancellationToken cancellationToken)
        {
            if (planId == null) throw Required("Menu plan");
            MenuPlan plan = await repository.MenuPlan.FindByCondition(x => x.Id == planId && x.BuyerId == ctx.Buyer.Id && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundCustomException("Menu plan not found.", "Select a menu plan of this organization.");
            plan.Status = "CONFIRMED";
            List<MenuPlanLine> lines = await repository.MenuPlanLine.FindByCondition(x => x.MenuPlanId == plan.Id && x.IsActive).ToListAsync(cancellationToken);
            foreach (MenuPlanLine line in lines.Where(x => !x.PortionsConfirmed))
            {
                line.PlannedPortions ??= line.RecommendedPortions;
                line.PortionsConfirmed = true;
            }
            return plan.Id;
        }

        private static async Task<SilaPmsDemandDto> DemandAsync(IRepositoryWrapper repository, MenuContext ctx, SilaMenuEngineeringFilterDto filter, CancellationToken cancellationToken)
        {
            DateTime from = (filter.DateFrom ?? DateTime.UtcNow.Date).Date;
            DateTime to = (filter.DateTo ?? from.AddDays(6)).Date;
            List<PmsDemandSnapshot> snaps = await repository.PmsDemandSnapshot.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive && x.BusinessDate >= from && x.BusinessDate <= to).ToListAsync(cancellationToken);
            if (filter.PropertyId != null) snaps = snaps.Where(x => x.PropertyId == filter.PropertyId || x.PropertyId == null).ToList();
            PmsDemandSnapshot? latest = snaps.OrderByDescending(x => x.BusinessDate).ThenByDescending(x => x.DateUpdated).FirstOrDefault();
            SilaMenuRequirementDto requirements = await RequirementsAsync(repository, ctx, filter, cancellationToken);
            SilaMenuPlanPageDto plans = await PlansAsync(repository, ctx, filter, cancellationToken);
            List<SilaMenuDemandDayDto> days = new();
            for (DateTime day = from; day <= to; day = day.AddDays(1))
            {
                PmsDemandSnapshot? snap = snaps.Where(x => x.BusinessDate.Date == day).OrderByDescending(x => x.DateUpdated).FirstOrDefault();
                List<SilaMenuPlanSummaryDto> dayPlans = plans.Items.Where(x => x.BusinessDate.Date == day).ToList();
                days.Add(new SilaMenuDemandDayDto
                {
                    BusinessDate = day,
                    OccupancyPercent = snap?.OccupancyPercent,
                    ExpectedGuests = snap?.ExpectedGuests ?? dayPlans.Sum(x => x.ExpectedGuests ?? 0),
                    ExpectedCovers = dayPlans.Sum(x => x.ExpectedCovers ?? 0),
                    RecommendedPortions = 0,
                    PlannedPortions = 0,
                    IngredientRequirement = requirements.Rows.Where(x => x.RequiredDate == null || x.RequiredDate.Value.Date == day).Sum(x => x.Requirement),
                    AvailableInventory = requirements.Rows.Sum(x => x.Available),
                    OpenPoCoverage = requirements.Rows.Sum(x => x.OpenPo),
                    Shortage = requirements.Rows.Where(x => x.RequiredDate == null || x.RequiredDate.Value.Date == day).Sum(x => x.Shortage),
                    Source = snap?.Source ?? "MANUAL",
                    Freshness = snap == null ? "UNAVAILABLE" : FreshnessOf(snap, ctx.Settings)
                });
            }
            return latest == null
                ? new SilaPmsDemandDto { BusinessDate = from, Source = SilaPmsAdapters.MANUAL, Status = "UNAVAILABLE", Message = "No OPERA forecast available.", Freshness = "UNAVAILABLE", Days = days }
                : new SilaPmsDemandDto
                {
                    Id = latest.Id,
                    PropertyId = latest.PropertyId,
                    BusinessDate = latest.BusinessDate,
                    OccupancyPercent = latest.OccupancyPercent,
                    RoomsAvailable = latest.RoomsAvailable,
                    RoomsOccupied = latest.RoomsOccupied,
                    ExpectedGuests = latest.ExpectedGuests,
                    Adults = latest.Adults,
                    Children = latest.Children,
                    Arrivals = latest.Arrivals,
                    Departures = latest.Departures,
                    Stayovers = latest.Stayovers,
                    Reservations = latest.Reservations,
                    ForecastReservations = latest.ForecastReservations,
                    GroupBookings = latest.GroupBookings,
                    MealPlans = latest.MealPlans,
                    Events = latest.Events,
                    Source = latest.Source,
                    Provider = latest.Provider,
                    Status = latest.Status,
                    SourceTimestamp = latest.SourceTimestamp,
                    LastSuccessfulSync = latest.LastSuccessfulSync,
                    Freshness = FreshnessOf(latest, ctx.Settings),
                    Message = latest.Message,
                    Days = days
                };
        }

        private static async Task<Guid> SavePmsAsync(IRepositoryWrapper repository, MenuContext ctx, Guid userId, SilaPmsDemandWriteDto dto, CancellationToken cancellationToken)
        {
            DateTime day = (dto.BusinessDate == default ? DateTime.UtcNow : dto.BusinessDate).Date;
            PmsDemandSnapshot snap = await repository.PmsDemandSnapshot.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.BusinessDate == day && x.PropertyId == dto.PropertyId && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                ?? new PmsDemandSnapshot { Id = Guid.NewGuid(), BuyerId = ctx.Buyer.Id, BusinessDate = day, IsActive = true };
            if (snap.DateCreated == default) repository.PmsDemandSnapshot.Create(snap);
            snap.PropertyId = dto.PropertyId;
            snap.Source = SilaPmsAdapters.MANUAL;
            snap.Provider = ctx.Settings.PmsProvider ?? SilaPmsAdapters.OPERA;
            snap.OccupancyPercent = dto.OccupancyPercent;
            snap.RoomsAvailable = dto.RoomsAvailable;
            snap.RoomsOccupied = dto.RoomsOccupied;
            snap.ExpectedGuests = dto.ExpectedGuests;
            snap.Adults = dto.Adults;
            snap.Children = dto.Children;
            snap.Arrivals = dto.Arrivals;
            snap.Departures = dto.Departures;
            snap.Stayovers = dto.Stayovers;
            snap.Reservations = dto.Reservations;
            snap.ForecastReservations = dto.ForecastReservations;
            snap.GroupBookings = dto.GroupBookings;
            snap.MealPlans = dto.MealPlans;
            snap.Events = dto.Events;
            snap.Status = "CURRENT";
            snap.SourceTimestamp = DateTime.UtcNow;
            snap.LastSuccessfulSync = DateTime.UtcNow;
            snap.Freshness = "CURRENT";
            snap.Message = null;
            return snap.Id;
        }

        private static async Task<Guid> PullPmsAsync(IRepositoryWrapper repository, MenuContext ctx, Guid userId, SilaPmsDemandWriteDto? dto, CancellationToken cancellationToken)
        {
            DateTime day = (dto?.BusinessDate == default || dto == null ? DateTime.UtcNow : dto.BusinessDate).Date;
            PmsDemandSnapshot snap = SilaPmsAdapters.Unavailable(ctx.Buyer.Id, dto?.PropertyId, day, ctx.Settings.PmsProvider ?? SilaPmsAdapters.OPERA,
                string.IsNullOrWhiteSpace(ctx.Settings.PmsConnectionName)
                    ? "PMS forecast is unavailable. Configure the OPERA connection in Menu Engineering Setup or enter demand manually."
                    : "PMS data is stale. The OPERA adapter is configured but did not return occupancy. Manual demand can be used.");
            repository.PmsDemandSnapshot.Create(snap);
            return snap.Id;
        }

        private static string FreshnessOf(PmsDemandSnapshot snap, MenuEngineeringSettings settings)
        {
            if (snap.LastSuccessfulSync == null) return "UNAVAILABLE";
            return (DateTime.UtcNow - snap.LastSuccessfulSync.Value).TotalHours > settings.StaleHours ? "STALE" : "CURRENT";
        }

        private static async Task<SilaMenuPosSalesDto> PosSalesAsync(IRepositoryWrapper repository, MenuContext ctx, SilaMenuEngineeringFilterDto filter, CancellationToken cancellationToken)
        {
            DateTime from = (filter.DateFrom ?? DateTime.UtcNow.Date).Date;
            DateTime to = (filter.DateTo ?? from).Date.AddDays(1);
            List<PosSalesTransaction> sales = await repository.PosSalesTransaction.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive && x.BusinessDate >= from && x.BusinessDate < to).ToListAsync(cancellationToken);
            List<MenuPosMapping> mappings = await repository.MenuPosMapping.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive).ToListAsync(cancellationToken);
            Dictionary<Guid, MenuItem> items = await ItemsOfAsync(repository, ctx.Buyer.Id, mappings.Where(x => x.MenuItemId != null).Select(x => x.MenuItemId!.Value), cancellationToken);
            List<SilaMenuPosSaleRowDto> rows = sales.Select(sale =>
            {
                MenuPosMapping? map = mappings.FirstOrDefault(x => string.Equals(x.PosCode, sale.PosCode, StringComparison.OrdinalIgnoreCase)
                    && (x.OutletLocationId == null || x.OutletLocationId == sale.OutletLocationId)
                    && x.MenuItemId != null
                    && x.Status == "ACTIVE");
                items.TryGetValue(map?.MenuItemId ?? Guid.Empty, out MenuItem? item);
                return new SilaMenuPosSaleRowDto
                {
                    Id = sale.Id,
                    BusinessDate = sale.BusinessDate,
                    SourceTransactionId = sale.SourceTransactionId,
                    LineNumber = sale.LineNumber,
                    PosCode = sale.PosCode,
                    OutletName = ctx.Scope.FirstOrDefault(x => x.Id == sale.OutletLocationId)?.LocationName,
                    MenuItemId = map?.MenuItemId,
                    MenuItemName = item?.Name,
                    RecipeId = sale.RecipeId ?? item?.LinkedRecipeId,
                    Quantity = sale.QuantitySold,
                    Uom = sale.Uom,
                    Amount = sale.Amount,
                    Currency = sale.Currency,
                    Status = map?.MenuItemId == null ? "UNMAPPED" : sale.Status
                };
            }).ToList();
            return new SilaMenuPosSalesDto
            {
                QtySold = rows.Sum(x => x.Quantity),
                Revenue = rows.Sum(x => x.Amount ?? 0),
                TransactionCount = rows.Count,
                UnmappedCount = rows.Count(x => x.MenuItemId == null),
                LastSync = sales.Count == 0 ? null : sales.Max(x => x.DateUpdated),
                SyncStatus = sales.Count == 0 ? "NO_POS_SALES" : "READY",
                Rows = rows.Take(200).ToList()
            };
        }

        private static async Task<SilaMenuPosMappingPageDto> MappingsAsync(IRepositoryWrapper repository, MenuContext ctx, SilaMenuEngineeringFilterDto filter, CancellationToken cancellationToken)
        {
            await SuggestMappingsAsync(repository, ctx, cancellationToken);
            IQueryable<MenuPosMapping> query = repository.MenuPosMapping.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive);
            if (!string.IsNullOrWhiteSpace(filter.Status)) query = query.Where(x => x.Status == filter.Status);
            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                string term = filter.Search.Trim();
                query = query.Where(x => x.PosCode.Contains(term) || (x.PosDescription != null && x.PosDescription.Contains(term)));
            }
            List<MenuPosMapping> rows = await query.OrderBy(x => x.Status).ThenBy(x => x.PosCode).Take(300).ToListAsync(cancellationToken);
            Dictionary<Guid, MenuItem> items = await ItemsOfAsync(repository, ctx.Buyer.Id, rows.Select(x => x.MenuItemId ?? Guid.Empty).Concat(rows.Select(x => x.SuggestedMenuItemId ?? Guid.Empty)), cancellationToken);
            return new SilaMenuPosMappingPageDto
            {
                Total = rows.Count,
                Items = rows.Select(x => new SilaMenuPosMappingDto
                {
                    Id = x.Id,
                    PosCode = x.PosCode,
                    PosDescription = x.PosDescription,
                    OutletLocationId = x.OutletLocationId,
                    OutletName = ctx.Scope.FirstOrDefault(l => l.Id == x.OutletLocationId)?.LocationName,
                    MenuItemId = x.MenuItemId,
                    MenuItemName = x.MenuItemId != null && items.TryGetValue(x.MenuItemId.Value, out MenuItem? item) ? item.Name : null,
                    SuggestedMenuItemId = x.SuggestedMenuItemId,
                    SuggestedMenuItemName = x.SuggestedMenuItemId != null && items.TryGetValue(x.SuggestedMenuItemId.Value, out MenuItem? suggested) ? suggested.Name : null,
                    SuggestionConfidence = x.SuggestionConfidence,
                    Status = x.Status,
                    MappingSource = x.MappingSource,
                    EffectiveFrom = x.EffectiveFrom,
                    EffectiveTo = x.EffectiveTo
                }).ToList()
            };
        }

        private static async Task SuggestMappingsAsync(IRepositoryWrapper repository, MenuContext ctx, CancellationToken cancellationToken)
        {
            List<string> sold = await repository.PosSalesTransaction.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive).Select(x => x.PosCode).Distinct().ToListAsync(cancellationToken);
            List<MenuPosMapping> existing = await repository.MenuPosMapping.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive).ToListAsync(cancellationToken);
            List<MenuItem> items = await repository.MenuItem.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive).ToListAsync(cancellationToken);
            foreach (string code in sold)
            {
                if (existing.Any(x => string.Equals(x.PosCode, code, StringComparison.OrdinalIgnoreCase))) continue;
                MenuItem? match = items.FirstOrDefault(x => string.Equals(x.MenuItemCode, code, StringComparison.OrdinalIgnoreCase) || string.Equals(x.Name, code, StringComparison.OrdinalIgnoreCase));
                repository.MenuPosMapping.Create(new MenuPosMapping
                {
                    Id = Guid.NewGuid(),
                    BuyerId = ctx.Buyer.Id,
                    PosCode = code,
                    Status = "UNMAPPED",
                    MappingSource = match == null ? "SYSTEM" : "SUGGESTED",
                    SuggestedMenuItemId = match?.Id,
                    SuggestionConfidence = match == null ? null : 0.6m,
                    IsActive = true
                });
            }
            await repository.SaveAsync();
        }

        private static async Task<Guid> UpsertMappingAsync(IRepositoryWrapper repository, MenuContext ctx, Guid userId, SilaMenuPosMappingWriteDto dto, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(dto.PosCode)) throw new BadRequestCustomException("POS code is required.", "Enter the POS item code.");
            await EnsureItemAsync(repository, ctx.Buyer.Id, dto.MenuItemId, cancellationToken);
            MenuPosMapping map = dto.Id is Guid id && id != Guid.Empty
                ? await repository.MenuPosMapping.FindByCondition(x => x.Id == id && x.BuyerId == ctx.Buyer.Id).FirstOrDefaultAsync(cancellationToken) ?? throw new NotFoundCustomException("POS mapping not found.", "Select an existing POS mapping.")
                : new MenuPosMapping { Id = Guid.NewGuid(), BuyerId = ctx.Buyer.Id, IsActive = true };
            if (dto.Id == null || dto.Id == Guid.Empty) repository.MenuPosMapping.Create(map);
            map.PosCode = dto.PosCode.Trim();
            map.PosDescription = dto.PosDescription;
            map.OutletLocationId = dto.OutletLocationId;
            map.MenuItemId = dto.MenuItemId;
            map.EffectiveFrom = dto.EffectiveFrom;
            map.EffectiveTo = dto.EffectiveTo;
            map.Status = "ACTIVE";
            map.MappingSource = "MANUAL";
            return map.Id;
        }

        private static async Task<int> ImportPosAsync(IRepositoryWrapper repository, MenuContext ctx, Guid userId, string csv, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(csv)) return 0;
            List<PosSalesTransaction> existing = await repository.PosSalesTransaction.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive).ToListAsync(cancellationToken);
            HashSet<string> keys = existing.Select(x => $"{x.SourceTransactionId}|{x.LineNumber}").ToHashSet(StringComparer.OrdinalIgnoreCase);
            int imported = 0;
            foreach (string raw in csv.Split('\n'))
            {
                string line = raw.Trim();
                if (line.Length == 0 || line.StartsWith("BusinessDate", StringComparison.OrdinalIgnoreCase)) continue;
                string[] parts = line.Split(',');
                if (parts.Length < 5) continue;
                DateTime date = DateTime.TryParse(parts[0], CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out DateTime parsed) ? parsed.Date : DateTime.UtcNow.Date;
                string txn = parts[1].Trim();
                int lineNo = int.TryParse(parts[2], out int n) ? n : 1;
                string key = $"{txn}|{lineNo}";
                if (!keys.Add(key)) continue;
                repository.PosSalesTransaction.Create(new PosSalesTransaction
                {
                    Id = Guid.NewGuid(),
                    BuyerId = ctx.Buyer.Id,
                    SourceTransactionId = txn,
                    LineNumber = lineNo,
                    BusinessDate = date,
                    OutletCode = parts.Length > 6 ? parts[6].Trim() : "",
                    PosCode = parts[3].Trim(),
                    QuantitySold = decimal.TryParse(parts[4], NumberStyles.Any, CultureInfo.InvariantCulture, out decimal qty) ? qty : 0,
                    Uom = parts.Length > 5 ? parts[5].Trim() : null,
                    Amount = parts.Length > 7 && decimal.TryParse(parts[7], NumberStyles.Any, CultureInfo.InvariantCulture, out decimal amount) ? amount : null,
                    Currency = parts.Length > 8 ? parts[8].Trim() : null,
                    Status = "IMPORTED",
                    IsActive = true
                });
                imported++;
            }
            return imported;
        }

        private static async Task<SilaMenuPerformanceDto> PerformanceAsync(IRepositoryWrapper repository, MenuContext ctx, SilaMenuEngineeringFilterDto filter, CancellationToken cancellationToken)
        {
            SilaMenuPosSalesDto sales = await PosSalesAsync(repository, ctx, filter, cancellationToken);
            List<MenuItem> items = await repository.MenuItem.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive).ToListAsync(cancellationToken);
            Dictionary<Guid, Recipe> recipes = await RecipesOfAsync(repository, ctx.Buyer.Id, items.Where(x => x.LinkedRecipeId != null).Select(x => x.LinkedRecipeId!.Value), cancellationToken);
            decimal totalQty = sales.Rows.Where(x => x.MenuItemId != null).Sum(x => x.Quantity);
            List<SilaMenuPerformanceRowDto> rows = items.Select(item =>
            {
                List<SilaMenuPosSaleRowDto> sold = sales.Rows.Where(x => x.MenuItemId == item.Id).ToList();
                decimal qty = sold.Sum(x => x.Quantity);
                decimal revenue = sold.Sum(x => x.Amount ?? ((item.SellingPrice ?? 0) * x.Quantity));
                recipes.TryGetValue(item.LinkedRecipeId ?? Guid.Empty, out Recipe? recipe);
                decimal? cost = recipe is { TotalCost: > 0, ServingQty: > 0 } ? recipe.TotalCost / recipe.ServingQty : null;
                decimal? cm = item.SellingPrice != null && cost != null ? item.SellingPrice - cost : null;
                return new SilaMenuPerformanceRowDto
                {
                    MenuItemId = item.Id,
                    Name = item.Name,
                    Category = item.Category,
                    QtySold = qty,
                    Revenue = revenue,
                    MixPercent = totalQty == 0 ? 0 : qty / totalQty,
                    SellingPrice = item.SellingPrice,
                    CostPerPortion = cost,
                    FoodCostPercent = item.SellingPrice is > 0 && cost != null ? cost / item.SellingPrice : null,
                    ContributionMargin = cm,
                    MarginPercent = item.SellingPrice is > 0 && cm != null ? cm / item.SellingPrice : null,
                    PopularityPercent = totalQty == 0 ? 0 : qty / totalQty,
                    CostState = recipe == null ? "RECIPE_REQUIRED" : cost == null ? "COST_PENDING" : "READY"
                };
            }).ToList();
            decimal avgMix = rows.Count == 0 ? 0 : rows.Average(x => x.MixPercent);
            decimal avgCm = rows.Where(x => x.ContributionMargin != null).Select(x => x.ContributionMargin!.Value).DefaultIfEmpty(0).Average();
            foreach (SilaMenuPerformanceRowDto row in rows)
            {
                bool popular = row.MixPercent >= avgMix * ctx.Settings.PopularityThreshold;
                bool profitable = row.ContributionMargin != null && row.ContributionMargin >= avgCm;
                row.Classification = row.CostState != "READY" ? "UNCLASSIFIED" : popular && profitable ? "STAR" : popular ? "PLOWHORSE" : profitable ? "PUZZLE" : "DOG";
            }
            return new SilaMenuPerformanceDto
            {
                Rows = rows.OrderByDescending(x => x.Revenue).ToList(),
                Stars = rows.Count(x => x.Classification == "STAR"),
                Plowhorses = rows.Count(x => x.Classification == "PLOWHORSE"),
                Puzzles = rows.Count(x => x.Classification == "PUZZLE"),
                Dogs = rows.Count(x => x.Classification == "DOG")
            };
        }

        private static async Task<SilaMenuConsumptionDto> ConsumptionAsync(IRepositoryWrapper repository, MenuContext ctx, SilaMenuEngineeringFilterDto filter, CancellationToken cancellationToken)
        {
            DateTime from = (filter.DateFrom ?? DateTime.UtcNow.Date).Date;
            DateTime to = (filter.DateTo ?? from).Date.AddDays(1);
            SilaMenuPosSalesDto sales = await PosSalesAsync(repository, ctx, filter, cancellationToken);
            List<Guid> recipeIds = sales.Rows.Where(x => x.RecipeId != null).Select(x => x.RecipeId!.Value).Distinct().ToList();
            List<RecipeIngredient> ingredients = recipeIds.Count == 0 ? new() : await repository.RecipeIngredient.FindByCondition(x => recipeIds.Contains(x.RecipeId) && x.IsActive).ToListAsync(cancellationToken);
            Dictionary<Guid, Recipe> recipes = await RecipesOfAsync(repository, ctx.Buyer.Id, recipeIds, cancellationToken);
            List<Guid> materialIds = ingredients.Where(x => x.MaterialId != null).Select(x => x.MaterialId!.Value).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = materialIds.Count == 0 ? new() : await repository.ItemBuyerMaster.FindByCondition(x => materialIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            List<InventoryTransaction> actuals = materialIds.Count == 0 || ctx.ScopeIds.Count == 0
                ? new()
                : await repository.InventoryTransaction.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive && materialIds.Contains(x.MaterialId) && ctx.ScopeIds.Contains(x.LocationId) && x.BusinessDate >= from && x.BusinessDate < to && (x.TransactionType == Common.SILA_TXN_GOODS_ISSUE_OUT || x.Direction == "OUT")).ToListAsync(cancellationToken);
            List<SilaMenuConsumptionRowDto> rows = new();
            foreach (IGrouping<Guid?, RecipeIngredient> group in ingredients.GroupBy(x => x.MaterialId))
            {
                if (group.Key == null) continue;
                decimal theoretical = 0;
                string recipeName = "";
                string menuName = "";
                foreach (RecipeIngredient ingredient in group)
                {
                    recipes.TryGetValue(ingredient.RecipeId, out Recipe? recipe);
                    decimal per = recipe is { ServingQty: > 0 } ? ingredient.Quantity / recipe.ServingQty : ingredient.Quantity;
                    decimal sold = sales.Rows.Where(x => x.RecipeId == ingredient.RecipeId).Sum(x => x.Quantity);
                    theoretical += sold * per;
                    recipeName = recipe?.Name ?? recipeName;
                    menuName = sales.Rows.FirstOrDefault(x => x.RecipeId == ingredient.RecipeId)?.MenuItemName ?? menuName;
                }
                decimal actual = actuals.Where(x => x.MaterialId == group.Key).Sum(x => x.Quantity);
                materials.TryGetValue(group.Key.Value, out ItemBuyerMaster? material);
                decimal variance = actual - theoretical;
                rows.Add(new SilaMenuConsumptionRowDto
                {
                    MaterialId = group.Key,
                    MaterialName = material?.Description ?? material?.MaterialCode ?? "Material",
                    RecipeName = recipeName,
                    MenuItemName = menuName,
                    Uom = group.First().Uom,
                    TheoreticalQty = Math.Round(theoretical, 4),
                    ActualQty = actual,
                    VarianceQty = Math.Round(variance, 4),
                    VariancePercent = theoretical == 0 ? null : variance / theoretical,
                    VarianceValue = material?.UnitCost == null ? null : variance * material.UnitCost
                });
            }
            return new SilaMenuConsumptionDto
            {
                Rows = rows.OrderByDescending(x => Math.Abs(x.VarianceQty)).ToList(),
                Theoretical = rows.Sum(x => x.TheoreticalQty),
                Actual = rows.Sum(x => x.ActualQty),
                Variance = rows.Sum(x => x.VarianceQty),
                VarianceValue = rows.Sum(x => x.VarianceValue ?? 0)
            };
        }

        private static async Task<SilaMenuRequirementDto> RequirementsAsync(IRepositoryWrapper repository, MenuContext ctx, SilaMenuEngineeringFilterDto filter, CancellationToken cancellationToken)
        {
            DateTime from = (filter.DateFrom ?? DateTime.UtcNow.Date).Date;
            DateTime to = (filter.DateTo ?? from).Date;
            List<MenuPlan> plans = await repository.MenuPlan.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive && x.BusinessDate >= from && x.BusinessDate <= to && (x.Status == "CONFIRMED" || x.Status == "PLANNED" || x.Status == "DRAFT")).ToListAsync(cancellationToken);
            if (filter.MenuPlanId != null) plans = plans.Where(x => x.Id == filter.MenuPlanId).ToList();
            List<Guid> planIds = plans.Select(x => x.Id).ToList();
            List<MenuPlanLine> lines = planIds.Count == 0 ? new() : await repository.MenuPlanLine.FindByCondition(x => planIds.Contains(x.MenuPlanId) && x.IsActive).ToListAsync(cancellationToken);
            Dictionary<Guid, MenuItem> items = await ItemsOfAsync(repository, ctx.Buyer.Id, lines.Select(x => x.MenuItemId), cancellationToken);
            Dictionary<Guid, Recipe> recipes = await RecipesOfAsync(repository, ctx.Buyer.Id, items.Values.Where(x => x.LinkedRecipeId != null).Select(x => x.LinkedRecipeId!.Value), cancellationToken);
            List<Guid> recipeIds = recipes.Keys.ToList();
            List<RecipeIngredient> ingredients = recipeIds.Count == 0 ? new() : await repository.RecipeIngredient.FindByCondition(x => recipeIds.Contains(x.RecipeId) && x.IsActive).ToListAsync(cancellationToken);
            Dictionary<(Guid MaterialId, string Uom, DateTime Day), decimal> need = new();
            foreach (MenuPlanLine line in lines)
            {
                if (!items.TryGetValue(line.MenuItemId, out MenuItem? item) || item.LinkedRecipeId == null) continue;
                if (!recipes.TryGetValue(item.LinkedRecipeId.Value, out Recipe? recipe)) continue;
                MenuPlan plan = plans.First(x => x.Id == line.MenuPlanId);
                decimal portions = line.PortionsConfirmed ? (line.PlannedPortions ?? line.RecommendedPortions) : line.RecommendedPortions;
                foreach (RecipeIngredient ingredient in ingredients.Where(x => x.RecipeId == recipe.Id && x.MaterialId != null))
                {
                    decimal per = recipe.ServingQty > 0 ? ingredient.Quantity / recipe.ServingQty : ingredient.Quantity;
                    var key = (ingredient.MaterialId!.Value, ingredient.Uom, plan.BusinessDate.Date);
                    need[key] = need.GetValueOrDefault(key) + (portions * per);
                }
            }
            List<Guid> materialIds = need.Keys.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = materialIds.Count == 0 ? new() : await repository.ItemBuyerMaster.FindByCondition(x => materialIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<(Guid LocationId, Guid MaterialId), decimal> onHand = materialIds.Count == 0 || ctx.ScopeIds.Count == 0
                ? new()
                : (await repository.InventoryBalance.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive && materialIds.Contains(x.MaterialId) && ctx.ScopeIds.Contains(x.LocationId)).Select(x => new { x.LocationId, x.MaterialId, x.OnHandQty }).ToListAsync(cancellationToken))
                    .GroupBy(x => (x.LocationId, x.MaterialId)).ToDictionary(x => x.Key, x => x.Sum(r => r.OnHandQty));
            SilaPurchaseRecommendationListDto existing = await SilaPurchaseRecommendation.BuildAsync(repository, ctx.Buyer.Id, ctx.Scope.Where(x => x.LocationType != Common.SILA_LOCATION_VENUE).ToList(), DateTime.UtcNow.Month, cancellationToken);
            List<SilaMenuRequirementRowDto> rows = need.GroupBy(x => x.Key.MaterialId).Select(group =>
            {
                decimal requirement = group.Sum(x => x.Value);
                decimal available = onHand.Where(x => x.Key.MaterialId == group.Key).Sum(x => x.Value);
                decimal openPo = existing.Items.Where(x => x.MaterialId == group.Key).Sum(x => x.OpenPoQty);
                decimal net = Math.Max(0, requirement - available - openPo);
                materials.TryGetValue(group.Key, out ItemBuyerMaster? material);
                return new SilaMenuRequirementRowDto
                {
                    MaterialId = group.Key,
                    MaterialName = material?.Description ?? material?.MaterialCode ?? "Material",
                    Uom = group.First().Key.Uom,
                    Requirement = Math.Round(requirement, 4),
                    Available = available,
                    OpenPo = openPo,
                    NetRequirement = Math.Round(net, 4),
                    Shortage = Math.Round(net, 4),
                    RequiredDate = group.Min(x => x.Key.Day),
                    Reason = "MENU_PLAN"
                };
            }).OrderByDescending(x => x.Shortage).ToList();
            return new SilaMenuRequirementDto { Rows = rows, TotalShortage = rows.Sum(x => x.Shortage) };
        }

        private static async Task<SilaMenuRecommendationDto> RecommendationsAsync(IRepositoryWrapper repository, MenuContext ctx, SilaMenuEngineeringFilterDto filter, CancellationToken cancellationToken)
        {
            SilaMenuRequirementDto demand = await RequirementsAsync(repository, ctx, filter, cancellationToken);
            SilaPurchaseRecommendationListDto existing = await SilaPurchaseRecommendation.BuildAsync(repository, ctx.Buyer.Id, ctx.Scope.Where(x => x.LocationType != Common.SILA_LOCATION_VENUE).ToList(), DateTime.UtcNow.Month, cancellationToken);
            foreach (SilaMenuRequirementRowDto row in demand.Rows.Where(x => x.Shortage > 0))
            {
                SilaPurchaseRecommendationDto? match = existing.Items.FirstOrDefault(x => x.MaterialId == row.MaterialId);
                if (match != null) match.Reason = string.IsNullOrWhiteSpace(match.Reason) ? "MENU_REQUIREMENT" : $"{match.Reason}+MENU_REQUIREMENT";
            }
            return new SilaMenuRecommendationDto { MenuDemand = demand.Rows, Existing = existing };
        }

        private static async Task<SilaMenuDashboardDto> DashboardAsync(IRepositoryWrapper repository, MenuContext ctx, SilaMenuEngineeringFilterDto filter, CancellationToken cancellationToken)
        {
            SilaMenuEngineeringFilterDto today = new()
            {
                DateFrom = filter.DateFrom ?? DateTime.UtcNow.Date,
                DateTo = filter.DateTo ?? DateTime.UtcNow.Date,
                PropertyId = filter.PropertyId,
                OutletLocationId = filter.OutletLocationId,
                MealPeriod = filter.MealPeriod
            };
            SilaMenuPerformanceDto performance = await PerformanceAsync(repository, ctx, today, cancellationToken);
            SilaMenuConsumptionDto consumption = await ConsumptionAsync(repository, ctx, today, cancellationToken);
            SilaMenuRequirementDto requirements = await RequirementsAsync(repository, ctx, today, cancellationToken);
            SilaMenuPlanPageDto plans = await PlansAsync(repository, ctx, today, cancellationToken);
            SilaPmsDemandDto demand = await DemandAsync(repository, ctx, today, cancellationToken);
            SilaMenuPosSalesDto sales = await PosSalesAsync(repository, ctx, today, cancellationToken);
            SilaMenuRecommendationDto recs = await RecommendationsAsync(repository, ctx, today, cancellationToken);
            List<MenuItem> items = await repository.MenuItem.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive).ToListAsync(cancellationToken);
            List<SilaMenuAttentionDto> attention = new();
            foreach (MenuItem item in items.Where(x => x.LinkedRecipeId == null && x.Status != "INACTIVE"))
                attention.Add(new SilaMenuAttentionDto { Kind = "RECIPE_MISSING", Title = "Recipe required", Message = $"{item.Name} has no linked recipe.", Route = "silaMenuItems", MenuItemId = item.Id });
            if (sales.UnmappedCount > 0)
                attention.Add(new SilaMenuAttentionDto { Kind = "POS_UNMAPPED", Title = "POS mapping required", Message = $"{sales.UnmappedCount} POS item(s) are not mapped to a menu item.", Route = "silaMenuPosMapping", Priority = "ACTION" });
            foreach (SilaMenuPerformanceRowDto row in performance.Rows.Where(x => x.CostState == "COST_PENDING"))
                attention.Add(new SilaMenuAttentionDto { Kind = "COST_MISSING", Title = "Cost pending", Message = $"{row.Name} has no authoritative recipe cost.", MenuItemId = row.MenuItemId, Route = "silaMenuCost" });
            if (demand.Freshness == "STALE" || demand.Freshness == "UNAVAILABLE")
                attention.Add(new SilaMenuAttentionDto { Kind = "PMS_STALE", Title = demand.Freshness == "STALE" ? "PMS data is stale" : "PMS forecast is unavailable", Message = demand.Message ?? "Enter demand manually or configure OPERA.", Route = "silaMenuDemand" });
            foreach (SilaMenuRequirementRowDto row in requirements.Rows.Where(x => x.Shortage > 0).Take(8))
                attention.Add(new SilaMenuAttentionDto { Kind = "SHORTAGE", Title = "Forecast shortage", Message = $"{row.MaterialName} is short by {row.Shortage} {row.Uom}.", MaterialId = row.MaterialId, Route = "silaMenuRecommendations" });
            await SyncAttentionAsync(repository, ctx, attention, cancellationToken);
            return new SilaMenuDashboardDto
            {
                FoodRevenue = performance.Rows.Sum(x => x.Revenue),
                FoodCost = performance.Rows.Where(x => x.CostPerPortion != null).Sum(x => x.CostPerPortion!.Value * x.QtySold),
                FoodCostPercent = performance.Rows.Sum(x => x.Revenue) == 0 ? null : performance.Rows.Where(x => x.CostPerPortion != null).Sum(x => x.CostPerPortion!.Value * x.QtySold) / performance.Rows.Sum(x => x.Revenue),
                GrossMargin = performance.Rows.Sum(x => x.Revenue) - performance.Rows.Where(x => x.CostPerPortion != null).Sum(x => x.CostPerPortion!.Value * x.QtySold),
                AverageCostPerPortion = performance.Rows.Where(x => x.CostPerPortion != null).Select(x => x.CostPerPortion!.Value).DefaultIfEmpty().Average(),
                MenuItemsSold = sales.QtySold,
                ExpectedCovers = plans.Items.Sum(x => x.ExpectedCovers ?? 0),
                PlannedPortions = 0,
                TheoreticalConsumption = consumption.Theoretical,
                ActualConsumption = consumption.Actual,
                ConsumptionVariance = consumption.Variance,
                VarianceValue = consumption.VarianceValue,
                ForecastShortage = requirements.TotalShortage,
                PurchaseRecommendationValue = recs.Existing.Items.Sum(x => x.EstimatedValue ?? 0),
                Stars = performance.Stars,
                Plowhorses = performance.Plowhorses,
                Puzzles = performance.Puzzles,
                Dogs = performance.Dogs,
                MissingRecipes = items.Count(x => x.LinkedRecipeId == null && x.Status != "INACTIVE"),
                UnmappedPos = sales.UnmappedCount,
                MissingCost = performance.Rows.Count(x => x.CostState == "COST_PENDING"),
                Shortages = requirements.Rows.Count(x => x.Shortage > 0),
                OccupancySource = demand.Source,
                OccupancyFreshness = demand.Freshness,
                OccupancyPercent = demand.OccupancyPercent,
                ExpectedGuests = demand.ExpectedGuests,
                Attention = attention.Take(20).ToList(),
                Insights = Insights(performance, consumption, requirements, ctx.Settings).Take(8).ToList(),
                TodayMenus = plans.Items,
                TopPerformers = performance.Rows.Take(5).ToList(),
                ShortIngredientRows = requirements.Rows.Where(x => x.Shortage > 0).Take(8).ToList()
            };
        }

        private static async Task SyncAttentionAsync(IRepositoryWrapper repository, MenuContext ctx, List<SilaMenuAttentionDto> attention, CancellationToken cancellationToken)
        {
            foreach (SilaMenuAttentionDto item in attention.Take(30))
            {
                await SilaOperations.UpsertAlertAsync(repository, ctx.Buyer.Id, ctx.Buyer.Id, new SilaOperations.AlertDraft
                {
                    AlertType = item.Kind,
                    DeduplicationKey = $"MENU:{item.Kind}:{item.MenuItemId}:{item.MaterialId}",
                    Title = item.Title,
                    Message = item.Message,
                    SourceModule = MODULE,
                    SourceDocumentType = item.Kind,
                    SourceDocumentId = item.MenuItemId ?? item.MaterialId ?? Guid.Empty,
                    ActionRoute = item.Route
                }, cancellationToken);
            }
        }

        private static List<SilaMenuInsightDto> Insights(SilaMenuPerformanceDto performance, SilaMenuConsumptionDto consumption, SilaMenuRequirementDto requirements, MenuEngineeringSettings settings)
        {
            List<SilaMenuInsightDto> insights = new();
            foreach (SilaMenuPerformanceRowDto row in performance.Rows.Where(x => x.Classification == "STAR").Take(3))
                insights.Add(new SilaMenuInsightDto { Category = "MENU_OPTIMIZATION", Priority = "NORMAL", Title = $"{row.Name} is a STAR", Reason = "High popularity and high contribution margin.", RecommendedAction = "Promote and protect this item.", AffectedName = row.Name, MenuItemId = row.MenuItemId });
            foreach (SilaMenuPerformanceRowDto row in performance.Rows.Where(x => x.Classification == "PLOWHORSE").Take(3))
                insights.Add(new SilaMenuInsightDto { Category = "MENU_OPTIMIZATION", Priority = "ACTION", Title = $"{row.Name} is a PLOWHORSE", Reason = "High popularity with low margin.", RecommendedAction = "Review price, portion or recipe cost.", AffectedName = row.Name, MenuItemId = row.MenuItemId });
            foreach (SilaMenuPerformanceRowDto row in performance.Rows.Where(x => x.Classification == "PUZZLE").Take(3))
                insights.Add(new SilaMenuInsightDto { Category = "MENU_OPTIMIZATION", Priority = "NORMAL", Title = $"{row.Name} is a PUZZLE", Reason = "Low popularity with high margin.", RecommendedAction = "Promote or reposition this item.", AffectedName = row.Name, MenuItemId = row.MenuItemId });
            foreach (SilaMenuPerformanceRowDto row in performance.Rows.Where(x => x.Classification == "DOG").Take(3))
                insights.Add(new SilaMenuInsightDto { Category = "MENU_MIX", Priority = "ACTION", Title = $"{row.Name} is a DOG", Reason = "Low popularity and low margin.", RecommendedAction = "Review for removal or recipe redesign.", AffectedName = row.Name, MenuItemId = row.MenuItemId });
            foreach (SilaMenuPerformanceRowDto row in performance.Rows.Where(x => x.FoodCostPercent != null && x.FoodCostPercent >= settings.HighFoodCostPercent).Take(3))
                insights.Add(new SilaMenuInsightDto { Category = "COST", Priority = "ACTION", Title = $"{row.Name} food cost is high", Reason = $"Food cost is {(row.FoodCostPercent ?? 0):P1}.", RecommendedAction = "Review ingredient cost or selling price.", MenuItemId = row.MenuItemId, AffectedName = row.Name });
            foreach (SilaMenuConsumptionRowDto row in consumption.Rows.Where(x => x.VariancePercent != null && Math.Abs(x.VariancePercent.Value) >= 0.15m).Take(4))
                insights.Add(new SilaMenuInsightDto { Category = "CONSUMPTION", Priority = "ACTION", Title = $"{row.MaterialName} consumption variance", Reason = $"Actual vs theoretical variance is {row.VariancePercent:P0}.", RecommendedAction = "Check over-portioning, waste, leakage or POS mapping.", MaterialId = row.MaterialId, AffectedName = row.MaterialName });
            foreach (SilaMenuRequirementRowDto row in requirements.Rows.Where(x => x.Shortage > 0).Take(4))
                insights.Add(new SilaMenuInsightDto { Category = "PROCUREMENT", Priority = "CRITICAL", Title = $"{row.MaterialName} forecast shortage", Reason = $"Requirement exceeds inventory plus open PO by {row.Shortage} {row.Uom}.", RecommendedAction = "Review the existing purchase recommendation. Do not auto-create a PO.", MaterialId = row.MaterialId, AffectedName = row.MaterialName });
            if (performance.Rows.Count(x => x.CostState == "RECIPE_REQUIRED") > 0)
                insights.Add(new SilaMenuInsightDto { Category = "DEMAND", Priority = "ACTION", Title = "Menu items without recipes", Reason = $"{performance.Rows.Count(x => x.CostState == "RECIPE_REQUIRED")} item(s) cannot explode to ingredients.", RecommendedAction = "Link or create a recipe in Recipe Management." });
            foreach (SilaMenuConsumptionRowDto row in consumption.Rows.Where(x => x.VarianceQty > 0).Take(2))
                insights.Add(new SilaMenuInsightDto { Category = "PORTION", Priority = "ACTION", Title = $"{row.MenuItemName} portion variance", Reason = "Actual consumption is above theoretical portions.", RecommendedAction = "Review planned vs actual portions and waste.", AffectedName = row.MenuItemName });
            if (consumption.Rows.Select(x => x.MenuItemName).Distinct().Count() > 1)
                insights.Add(new SilaMenuInsightDto { Category = "OUTLET", Priority = "NORMAL", Title = "Compare outlet consumption", Reason = "Outlet-level theoretical vs actual is available for the selected period.", RecommendedAction = "Review outlet exceptions in Consumption Analysis." });
            return insights;
        }

        private static async Task<SilaMenuWhatIfResultDto> SimulateAsync(IRepositoryWrapper repository, MenuContext ctx, SilaMenuWhatIfRequestDto request, CancellationToken cancellationToken)
        {
            SilaMenuEngineeringFilterDto filter = new() { MenuPlanId = request.MenuPlanId, DateFrom = DateTime.UtcNow.Date, DateTo = DateTime.UtcNow.Date };
            SilaMenuRequirementDto requirements = await RequirementsAsync(repository, ctx, filter, cancellationToken);
            SilaMenuPerformanceDto performance = await PerformanceAsync(repository, ctx, filter, cancellationToken);
            decimal coverFactor = 1;
            if (request.ExpectedCovers != null)
            {
                SilaMenuPlanPageDto plans = await PlansAsync(repository, ctx, filter, cancellationToken);
                decimal current = plans.Items.Sum(x => x.ExpectedCovers ?? 0);
                if (current > 0) coverFactor = request.ExpectedCovers.Value / current;
            }
            if (request.OccupancyPercent != null) coverFactor *= Math.Max(0.1m, request.OccupancyPercent.Value / 80m);
            if (request.MealParticipation != null) coverFactor *= request.MealParticipation.Value / Math.Max(0.01m, ctx.Settings.DefaultMealParticipation);
            decimal portionFactor = request.PortionFactor ?? 1;
            decimal priceFactor = request.PriceFactor ?? 1;
            decimal costFactor = request.CostFactor ?? 1;
            decimal portions = performance.Rows.Sum(x => x.QtySold) * coverFactor * portionFactor;
            decimal requirement = requirements.Rows.Sum(x => x.Requirement) * coverFactor * portionFactor;
            decimal shortage = Math.Max(0, requirement - requirements.Rows.Sum(x => x.Available + x.OpenPo));
            decimal revenue = performance.Rows.Sum(x => x.Revenue) * coverFactor * priceFactor;
            decimal foodCost = performance.Rows.Where(x => x.CostPerPortion != null).Sum(x => x.CostPerPortion!.Value * x.QtySold) * coverFactor * portionFactor * costFactor;
            return new SilaMenuWhatIfResultDto
            {
                RecommendedPortions = Math.Round(portions, 2),
                PlannedPortions = Math.Round(portions, 2),
                IngredientRequirement = Math.Round(requirement, 4),
                Shortage = Math.Round(shortage, 4),
                PurchaseRequirement = Math.Round(shortage, 4),
                FoodCost = Math.Round(foodCost, 2),
                Revenue = Math.Round(revenue, 2),
                ContributionMargin = Math.Round(revenue - foodCost, 2),
                MarginPercent = revenue == 0 ? null : (revenue - foodCost) / revenue
            };
        }

        private static async Task<Guid> SaveSettingsAsync(IRepositoryWrapper repository, MenuContext ctx, Guid userId, SilaMenuEngineeringSettingsDto dto, CancellationToken cancellationToken)
        {
            MenuEngineeringSettings settings = await repository.MenuEngineeringSettings.FindByCondition(x => x.BuyerId == ctx.Buyer.Id && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                ?? new MenuEngineeringSettings { Id = Guid.NewGuid(), BuyerId = ctx.Buyer.Id, IsActive = true };
            if (settings.DateCreated == default) repository.MenuEngineeringSettings.Create(settings);
            settings.DefaultMealParticipation = dto.DefaultMealParticipation;
            settings.DefaultItemParticipation = dto.DefaultItemParticipation;
            settings.DefaultBufferPercentage = dto.DefaultBufferPercentage;
            settings.DefaultAdultFactor = dto.DefaultAdultFactor;
            settings.DefaultChildFactor = dto.DefaultChildFactor;
            settings.PopularityThreshold = dto.PopularityThreshold;
            settings.HighFoodCostPercent = dto.HighFoodCostPercent;
            settings.StaleHours = dto.StaleHours <= 0 ? 24 : dto.StaleHours;
            settings.MealPeriodsJson = JsonSerializer.Serialize(dto.MealPeriods.Count == 0 ? DefaultMeals.ToList() : dto.MealPeriods);
            settings.CategoriesJson = JsonSerializer.Serialize(dto.Categories);
            settings.PmsProvider = string.IsNullOrWhiteSpace(dto.PmsProvider) ? SilaPmsAdapters.OPERA : dto.PmsProvider;
            settings.PmsConnectionName = dto.PmsConnectionName;
            settings.PosConnectionName = dto.PosConnectionName;
            settings.AiNotes = dto.AiNotes;
            ctx.Settings = settings;
            return settings.Id;
        }

        private static SilaMenuEngineeringSettingsDto ToSettings(MenuEngineeringSettings settings) => new()
        {
            DefaultMealParticipation = settings.DefaultMealParticipation,
            DefaultItemParticipation = settings.DefaultItemParticipation,
            DefaultBufferPercentage = settings.DefaultBufferPercentage,
            DefaultAdultFactor = settings.DefaultAdultFactor,
            DefaultChildFactor = settings.DefaultChildFactor,
            PopularityThreshold = settings.PopularityThreshold,
            HighFoodCostPercent = settings.HighFoodCostPercent,
            StaleHours = settings.StaleHours,
            MealPeriods = ReadList(settings.MealPeriodsJson, DefaultMeals),
            Categories = ReadList(settings.CategoriesJson, ["Food", "Beverage"]),
            PmsProvider = settings.PmsProvider,
            PmsConnectionName = settings.PmsConnectionName,
            PosConnectionName = settings.PosConnectionName,
            AiNotes = settings.AiNotes
        };

        private static async Task<Dictionary<Guid, decimal>> ActualPortionsAsync(IRepositoryWrapper repository, MenuContext ctx, IEnumerable<MenuItem> items, MenuPlan plan, CancellationToken cancellationToken)
        {
            Dictionary<Guid, MenuItem> byId = items.ToDictionary(x => x.Id);
            SilaMenuPosSalesDto sales = await PosSalesAsync(repository, ctx, new SilaMenuEngineeringFilterDto { DateFrom = plan.BusinessDate.Date, DateTo = plan.BusinessDate.Date, OutletLocationId = plan.OutletLocationId }, cancellationToken);
            return sales.Rows.Where(x => x.MenuItemId != null && byId.ContainsKey(x.MenuItemId.Value))
                .GroupBy(x => x.MenuItemId!.Value)
                .ToDictionary(x => x.Key, x => x.Sum(row => row.Quantity));
        }

        private static async Task<Dictionary<Guid, MenuItem>> ItemsOfAsync(IRepositoryWrapper repository, Guid buyerId, IEnumerable<Guid> ids, CancellationToken cancellationToken)
        {
            List<Guid> list = ids.Where(x => x != Guid.Empty).Distinct().ToList();
            if (list.Count == 0) return new Dictionary<Guid, MenuItem>();
            return await repository.MenuItem.FindByCondition(x => x.BuyerId == buyerId && list.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        }

        private static async Task<Dictionary<Guid, Recipe>> RecipesOfAsync(IRepositoryWrapper repository, Guid buyerId, IEnumerable<Guid> ids, CancellationToken cancellationToken)
        {
            List<Guid> list = ids.Where(x => x != Guid.Empty).Distinct().ToList();
            if (list.Count == 0) return new Dictionary<Guid, Recipe>();
            return await repository.Recipe.FindByCondition(x => x.BuyerId == buyerId && list.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        }

        private static async Task EnsureItemAsync(IRepositoryWrapper repository, Guid buyerId, Guid menuItemId, CancellationToken cancellationToken)
        {
            _ = await repository.MenuItem.FindByCondition(x => x.Id == menuItemId && x.BuyerId == buyerId && x.IsActive).FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundCustomException("Menu item not found.", "Select an existing menu item.");
        }

        private static List<string> ReadList(string? json, IEnumerable<string> fallback)
        {
            if (string.IsNullOrWhiteSpace(json)) return fallback.ToList();
            try
            {
                List<string>? values = JsonSerializer.Deserialize<List<string>>(json);
                return values is { Count: > 0 } ? values : fallback.ToList();
            }
            catch (JsonException)
            {
                return fallback.ToList();
            }
        }

        private static BadRequestCustomException Required(string name) =>
            new($"{name} is required.", $"Provide {name.ToLowerInvariant()}.");
    }
}
