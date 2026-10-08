using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DecideSilaRecipe
{
    /// <summary>
    /// Records the decision of the approver whose turn it is (approval engine, strictly in order). The last approval makes
    /// the version the active one (ActiveVersion = Version, APPROVED): POS sales consume it from then on. Any rejection
    /// makes the version REJECTED; the previously active version keeps selling.
    /// </summary>
    public class DecideSilaRecipeCommandHandler : IRequestHandler<DecideSilaRecipeCommand, Unit>
    {
        private const int MAX_COMMENT = 1000;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DecideSilaRecipeCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DecideSilaRecipeCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deciding recipe. RecipeId: {request.RecipeId}, Approve: {request.Approve}, UserId: {request.UserId}");

            string? comment = string.IsNullOrWhiteSpace(request.Request?.Comment) ? null : request.Request.Comment.Trim();
            if (comment != null && comment.Length > MAX_COMMENT)
            {
                _logger.LogError($"Decision comment too long. RecipeId: {request.RecipeId}");
                throw new BadRequestCustomException("Comment is too long.", $"Keep the comment within {MAX_COMMENT} characters.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Recipe recipe = await SilaRecipeRules.GetTrackedAsync(_repository, _logger, buyer.Id, request.RecipeId);
            if (recipe.Status != Common.SILA_RECIPE_PENDING_APPROVAL)
            {
                _logger.LogError($"Recipe is not pending approval. RecipeId: {recipe.Id}, Status: {recipe.Status}");
                throw new BadRequestCustomException("Recipe is not pending approval.", "Only a submitted recipe can be approved or rejected.");
            }

            ApprovalDecision decision = await SilaApprovals.DecideAsync(
                _repository, _logger, Common.SILA_REF_RECIPE, recipe.Id, recipe.Version, request.UserId, request.Approve, comment, cancellationToken);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            if (decision.Outcome == SilaApprovals.OUTCOME_REJECTED)
            {
                recipe.Status = Common.SILA_RECIPE_REJECTED;
                SilaRecipeRules.ClearDraftHeader(recipe);
                ledger.AddEvent(Common.SILA_REF_RECIPE, recipe.Id, SilaRecipeRules.EVENT_REJECTED, $"Version {recipe.Version}, level {decision.Level}: {comment}");
            }
            else
            {
                ledger.AddEvent(Common.SILA_REF_RECIPE, recipe.Id, SilaRecipeRules.EVENT_APPROVED, comment ?? $"Version {recipe.Version}, level {decision.Level}");
                if (decision.Outcome == SilaApprovals.OUTCOME_APPROVED)
                {
                    recipe.Status = Common.SILA_RECIPE_APPROVED;
                    recipe.ActiveVersion = recipe.Version;
                    SilaRecipeRules.PromoteDraftHeader(recipe);
                    recipe.ApprovedOn = DateTime.UtcNow;
                }
            }

            await _repository.SaveAsync();
            _logger.LogInfo($"Recipe decision recorded. RecipeId: {recipe.Id}, Level: {decision.Level}, Outcome: {decision.Outcome}, ActiveVersion: {recipe.ActiveVersion}");
            return Unit.Value;
        }
    }
}
