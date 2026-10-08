using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SubmitSilaRecipe
{
    /// <summary>
    /// Sends the latest DRAFT version of a recipe for approval. The version must be ready (ingredients with approved prices
    /// and unit conversions, outlet prices). Costs are refreshed from today's material prices, then the approval engine
    /// copies the approvers of the most specific RECIPE flow (first outlet, its property, its company code, or all).
    /// </summary>
    public class SubmitSilaRecipeCommandHandler : IRequestHandler<SubmitSilaRecipeCommand, Unit>
    {
        private const int MAX_ISSUES_IN_MESSAGE = 3;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SubmitSilaRecipeCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(SubmitSilaRecipeCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Submitting recipe. RecipeId: {request.RecipeId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Recipe recipe = await SilaRecipeRules.GetTrackedAsync(_repository, _logger, buyer.Id, request.RecipeId);
            if (recipe.Status != Common.SILA_RECIPE_DRAFT)
            {
                _logger.LogError($"Recipe is not a draft. RecipeId: {recipe.Id}, Status: {recipe.Status}");
                throw new BadRequestCustomException("Only a draft recipe can be submitted.", "Edit the recipe to start a new draft version, then submit it.");
            }

            SilaRecipeReadiness readiness = await SilaRecipeReadiness.LoadAsync(_repository, buyer.Id, new List<Guid> { recipe.Id }, cancellationToken);
            SilaRecipeReadinessDto check = readiness.Evaluate(recipe, recipe.Version);
            if (!check.Ready)
            {
                _logger.LogError($"Recipe is not ready for approval. RecipeId: {recipe.Id}, Version: {recipe.Version}, Issues: {check.Issues.Count}");
                string shown = string.Join("; ", check.Issues.Take(MAX_ISSUES_IN_MESSAGE));
                string more = check.Issues.Count > MAX_ISSUES_IN_MESSAGE ? $" (+{check.Issues.Count - MAX_ISSUES_IN_MESSAGE} more)" : string.Empty;
                throw new BadRequestCustomException("Recipe is not ready for approval.", $"Fix: {shown}{more}.");
            }

            // Costs and base quantities of the submitted version follow today's approved prices and conversions.
            List<RecipeIngredient> ingredients = readiness.IngredientsOf(recipe.Id, recipe.Version);
            decimal totalCost = 0;
            foreach (RecipeIngredient ingredient in ingredients)
            {
                ItemBuyerMaster? material = readiness.MaterialOf(ingredient);
                if (material != null)
                {
                    ingredient.BaseQuantity = readiness.BaseQuantityOf(ingredient) ?? 0;
                    ingredient.BaseUom = UomConverter.BaseUomOf(material);
                    ingredient.UnitCost = material.UnitCost;
                    ingredient.Cost = Math.Round(ingredient.BaseQuantity * (material.UnitCost ?? 0), 4);
                }

                totalCost += ingredient.Cost;
            }

            _repository.RecipeIngredient.UpdateRange(ingredients);
            SilaRecipeRules.SetVersionCost(recipe, Math.Round(totalCost, 4));

            ApprovalScope scope = await SilaRecipeRules.GetApprovalScopeAsync(_repository, recipe, cancellationToken);
            List<SilaApprovalStep> steps = await SilaApprovals.StartAsync(
                _repository, _logger, buyer.Id, Common.SILA_APPROVAL_TYPE_RECIPE, Common.SILA_REF_RECIPE, recipe.Id, recipe.Version, scope, cancellationToken);

            recipe.Status = Common.SILA_RECIPE_PENDING_APPROVAL;
            recipe.SubmittedBy = request.UserId;
            recipe.SubmittedOn = DateTime.UtcNow;
            new InventoryLedger(_repository, buyer.Id, request.UserId)
                .AddEvent(Common.SILA_REF_RECIPE, recipe.Id, SilaRecipeRules.EVENT_SUBMITTED, $"Version {recipe.Version}, {steps.Count} approval level(s).");
            await _repository.SaveAsync();

            _logger.LogInfo($"Recipe submitted. RecipeId: {recipe.Id}, Version: {recipe.Version}, Approvers: {steps.Count}, TotalCost: {recipe.TotalCost}");
            return Unit.Value;
        }
    }
}
