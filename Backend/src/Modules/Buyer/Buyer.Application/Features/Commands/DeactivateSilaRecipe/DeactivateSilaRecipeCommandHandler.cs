using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DeactivateSilaRecipe
{
    /// <summary>
    /// Retires a recipe (INACTIVE): POS sales no longer match it and a pending approval is cancelled. A recipe used in a batch
    /// stays active.
    /// </summary>
    public class DeactivateSilaRecipeCommandHandler : IRequestHandler<DeactivateSilaRecipeCommand, Unit>
    {
        private const string STEP_CANCELLED = "CANCELLED";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DeactivateSilaRecipeCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DeactivateSilaRecipeCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deactivating recipe. RecipeId: {request.RecipeId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Recipe recipe = await SilaRecipeRules.GetTrackedAsync(_repository, _logger, buyer.Id, request.RecipeId);
            if (recipe.Status == Common.SILA_RECIPE_INACTIVE)
            {
                _logger.LogError($"Recipe is already inactive. RecipeId: {recipe.Id}");
                throw new BadRequestCustomException("Recipe is already inactive.", "Nothing to change.");
            }

            string? usedIn = await _repository.RecipeIngredient
                .FindByCondition(x => x.IsActive
                    && x.SubRecipeId == recipe.Id
                    && x.Recipe.IsActive
                    && x.Recipe.Status != Common.SILA_RECIPE_INACTIVE
                    && (x.Version == x.Recipe.ActiveVersion || x.Version == x.Recipe.Version))
                .Select(x => x.Recipe.RecipeCode + " " + x.Recipe.Name)
                .FirstOrDefaultAsync(cancellationToken);
            if (usedIn != null)
            {
                _logger.LogError($"Recipe is used in a batch. RecipeId: {recipe.Id}, UsedIn: {usedIn}");
                throw new BadRequestCustomException("Recipe is used in a batch.", $"Remove it from {usedIn} first.");
            }

            List<SilaApprovalStep> pending = await _repository.SilaApprovalStep
                .FindByCondition(x => x.BuyerId == buyer.Id
                    && x.ReferenceType == Common.SILA_REF_RECIPE
                    && x.ReferenceId == recipe.Id
                    && x.IsActive
                    && x.Status == Common.SILA_APPROVAL_PENDING)
                .ToListAsync(cancellationToken);
            foreach (SilaApprovalStep step in pending)
            {
                step.Status = STEP_CANCELLED;
            }

            _repository.SilaApprovalStep.UpdateRange(pending);

            recipe.Status = Common.SILA_RECIPE_INACTIVE;
            SilaRecipeRules.ClearDraftHeader(recipe);
            new InventoryLedger(_repository, buyer.Id, request.UserId).AddEvent(Common.SILA_REF_RECIPE, recipe.Id, SilaRecipeRules.EVENT_DEACTIVATED, null);
            await _repository.SaveAsync();

            _logger.LogInfo($"Recipe deactivated. RecipeId: {recipe.Id}, CancelledSteps: {pending.Count}");
            return Unit.Value;
        }
    }
}
