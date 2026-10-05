using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;

namespace Buyer.Application.Features.Queries.GetSilaRecipe
{
    /// <summary>
    /// A recipe at one version (the latest by default): ingredients with today's price status and readiness issues, outlet
    /// prices with cost % and margin %, the version list, the approval trail of every version and the history.
    /// </summary>
    public class GetSilaRecipeQueryHandler : IRequestHandler<GetSilaRecipeQuery, SilaRecipeDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaRecipeQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<SilaRecipeDetailDto> Handle(GetSilaRecipeQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching recipe. RecipeId: {request.RecipeId}, Version: {request.Version}, OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Recipe? recipe = await _repository.Recipe
                .FindByCondition(x => x.Id == request.RecipeId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (recipe == null)
            {
                _logger.LogError($"Recipe not found. RecipeId: {request.RecipeId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Recipe not found.", "Select a recipe of this organization.");
            }

            int version = request.Version ?? recipe.Version;
            if (version < 1 || version > recipe.Version)
            {
                _logger.LogError($"Recipe version not found. RecipeId: {recipe.Id}, Version: {version}, Latest: {recipe.Version}");
                throw new NotFoundCustomException("Version not found.", $"Choose a version between 1 and {recipe.Version}.");
            }

            SilaRecipeReadiness readiness = await SilaRecipeReadiness.LoadAsync(_repository, buyer.Id, new List<Guid> { recipe.Id }, cancellationToken);
            List<RecipeIngredient> ingredients = readiness.IngredientsOf(recipe.Id, version);
            List<RecipeOutletPrice> prices = readiness.PricesOf(recipe.Id, version);
            List<Guid> locationIds = prices.Select(x => x.OutletLocationId).ToList();
            Dictionary<Guid, InventoryLocation> locations = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && locationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            string? familyName = recipe.FamilyId == null
                ? null
                : await _repository.RecipeFamily.FindByCondition(x => x.Id == recipe.FamilyId).Select(x => x.Name).FirstOrDefaultAsync(cancellationToken);
            string? categoryName = recipe.CategoryId == null
                ? null
                : await _repository.RecipeCategory.FindByCondition(x => x.Id == recipe.CategoryId).Select(x => x.Name).FirstOrDefaultAsync(cancellationToken);

            List<SilaApprovalStep> steps = await SilaApprovals.TrailAsync(_repository, Common.SILA_REF_RECIPE, recipe.Id, cancellationToken);
            List<InventoryWorkflowEvent> events = await _repository.InventoryWorkflowEvent
                .FindByCondition(x => x.BuyerId == buyer.Id && x.ReferenceType == Common.SILA_REF_RECIPE && x.ReferenceId == recipe.Id && x.IsActive)
                .OrderByDescending(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            List<IdentityUserDto> users = await GetUsersAsync(recipe, steps, events, cancellationToken);

            SilaApprovalStep? waiting = steps
                .Where(x => x.Version == recipe.Version && x.Status == Common.SILA_APPROVAL_PENDING)
                .OrderBy(x => x.Order)
                .FirstOrDefault();
            bool canDecide = recipe.Status == Common.SILA_RECIPE_PENDING_APPROVAL && waiting != null && waiting.UserId == request.UserId;
            decimal totalCost = Math.Round(ingredients.Sum(x => x.Cost), 4);
            // The pending version of an approved recipe shows its own header; every other version shows the active header.
            bool showDraft = SilaRecipeRules.ShowsDraftHeader(recipe, version);
            decimal servingQty = showDraft ? SilaRecipeRules.LatestServingQty(recipe) : recipe.ServingQty;
            decimal costPerServing = SilaRecipeRules.CostPerServing(totalCost, servingQty);

            _logger.LogInfo($"Recipe fetched. RecipeId: {recipe.Id}, Version: {version}, Ingredients: {ingredients.Count}, Outlets: {prices.Count}");
            return new SilaRecipeDetailDto
            {
                Id = recipe.Id,
                RecipeCode = recipe.RecipeCode,
                Name = showDraft ? SilaRecipeRules.LatestName(recipe) : recipe.Name,
                Description = recipe.Description,
                Category = recipe.Category,
                FamilyId = recipe.FamilyId,
                FamilyName = familyName,
                CategoryId = recipe.CategoryId,
                CategoryName = categoryName,
                ItemMode = recipe.ItemMode,
                ServingQty = servingQty,
                ServingUom = showDraft ? SilaRecipeRules.LatestServingUom(recipe) : recipe.ServingUom,
                SellingUom = showDraft ? SilaRecipeRules.LatestSellingUom(recipe) : recipe.SellingUom,
                PosCode = showDraft ? SilaRecipeRules.LatestPosCode(recipe) : recipe.PosCode,
                HasDraftHeader = SilaRecipeRules.HasDraftHeader(recipe),
                DraftName = recipe.DraftName,
                DraftPosCode = recipe.DraftPosCode,
                DraftServingQty = recipe.DraftServingQty,
                DraftServingUom = recipe.DraftServingUom,
                DraftSellingUom = recipe.DraftSellingUom,
                Status = recipe.Status,
                Version = recipe.Version,
                ActiveVersion = recipe.ActiveVersion,
                ViewVersion = version,
                ViewStatus = SilaRecipeRules.VersionStatus(recipe, version),
                Versions = SilaRecipeRules.Versions(recipe),
                TotalCost = totalCost,
                CostPerServing = costPerServing,
                PosItem = recipe.PosItem,
                LastSaleDate = recipe.LastSaleDate,
                Readiness = readiness.Evaluate(recipe, version),
                Currency = recipe.Currency,
                SubmittedBy = recipe.SubmittedBy,
                SubmittedByName = users.FirstOrDefault(x => x.UserId == recipe.SubmittedBy)?.Name,
                SubmittedOn = recipe.SubmittedOn,
                ApprovedOn = recipe.ApprovedOn,
                CanDecide = canDecide,
                Ingredients = ingredients.Select(x => ToIngredient(x, readiness)).ToList(),
                OutletPrices = prices.Select(x => new SilaRecipeOutletPriceDto
                {
                    Id = x.Id,
                    OutletLocationId = x.OutletLocationId,
                    LocationCode = locations.TryGetValue(x.OutletLocationId, out InventoryLocation? code) ? code.LocationCode : null,
                    LocationName = locations.TryGetValue(x.OutletLocationId, out InventoryLocation? name) ? name.LocationName : null,
                    MenuPrice = x.MenuPrice,
                    Currency = x.Currency,
                    CostPerServing = costPerServing,
                    CostPercent = SilaRecipeRules.CostPercent(costPerServing, x.MenuPrice),
                    MarginAmount = SilaRecipeRules.MarginAmount(costPerServing, x.MenuPrice),
                    MarginPercent = SilaRecipeRules.MarginPercent(costPerServing, x.MenuPrice)
                }).OrderBy(x => x.LocationName).ToList(),
                ApprovalSteps = steps.OrderByDescending(x => x.Version).ThenBy(x => x.Order).Select(x => new SilaRecipeApprovalStepDto
                {
                    UserId = x.UserId,
                    Name = users.FirstOrDefault(u => u.UserId == x.UserId)?.Name,
                    Email = users.FirstOrDefault(u => u.UserId == x.UserId)?.Email,
                    RoleName = users.FirstOrDefault(u => u.UserId == x.UserId)?.RoleName,
                    Version = x.Version,
                    Order = x.Order,
                    Status = x.Status,
                    Comment = x.Comment,
                    ActedOn = x.ActedOn
                }).ToList(),
                History = events.Select(x => new SilaRecipeEventDto
                {
                    Action = x.Action,
                    Comment = x.Comment,
                    ActorUserId = x.ActorUserId,
                    ActorName = users.FirstOrDefault(u => u.UserId == x.ActorUserId)?.Name,
                    DateCreated = x.DateCreated
                }).ToList()
            };
        }

        private static SilaRecipeIngredientDto ToIngredient(RecipeIngredient ingredient, SilaRecipeReadiness readiness)
        {
            MaterialEntity? material = readiness.MaterialOf(ingredient);
            return new SilaRecipeIngredientDto
            {
                Id = ingredient.Id,
                IngredientCode = ingredient.IngredientCode,
                MaterialId = ingredient.MaterialId,
                SubRecipeId = ingredient.SubRecipeId,
                ItemCode = ingredient.ItemCode,
                ItemName = ingredient.ItemName,
                Quantity = ingredient.Quantity,
                Uom = ingredient.Uom,
                BaseQuantity = ingredient.BaseQuantity,
                BaseUom = ingredient.BaseUom,
                UnitCost = ingredient.UnitCost,
                Cost = ingredient.Cost,
                Sequence = ingredient.Sequence,
                PriceStatus = readiness.PriceStatusOf(ingredient),
                CurrentUnitCost = material?.UnitCost,
                Currency = material?.Currency,
                PriceUom = material == null ? null : UomConverter.BaseUomOf(material),
                ProposedUnitPrice = material == null ? null : readiness.ProposedPriceOf(material.Id),
                PackSummary = material == null ? null : SilaRecipeReadiness.PackSummary(readiness.ConversionsOf(material.Id)),
                CanUpdatePrice = material != null && readiness.CanUpdatePrice(material.Id),
                Conversions = material == null
                    ? new List<SilaUomConversionDto>()
                    : readiness.ConversionsOf(material.Id)
                        .Select(c => new SilaUomConversionDto { Id = c.Id, FromUom = c.FromUom, ToUom = c.ToUom, Factor = c.Factor })
                        .ToList(),
                Issue = readiness.LineIssue(ingredient)
            };
        }

        private async Task<List<IdentityUserDto>> GetUsersAsync(
            Recipe recipe, List<SilaApprovalStep> steps, List<InventoryWorkflowEvent> events, CancellationToken cancellationToken)
        {
            List<Guid> userIds = steps.Select(x => x.UserId)
                .Concat(events.Select(x => x.ActorUserId))
                .Concat(recipe.SubmittedBy == null ? new List<Guid>() : new List<Guid> { recipe.SubmittedBy.Value })
                .Where(x => x != Guid.Empty)
                .Distinct()
                .ToList();
            return userIds.Count == 0
                ? new List<IdentityUserDto>()
                : await _identityApiClient.GetUsersByIds(userIds, cancellationToken);
        }
    }
}
