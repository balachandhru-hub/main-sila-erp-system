using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaSubstitution
{
    /// <summary>
    /// The review of a recipe change suggestion: the recipe's approved ingredients with their stock in the property (short
    /// ones flagged), the best in-stock suggestions per short ingredient with the line they become and the recipe cost and
    /// margin per outlet if chosen. Suggestions are recomputed on every read.
    /// </summary>
    public class GetSilaSubstitutionQueryHandler : IRequestHandler<GetSilaSubstitutionQuery, SilaSubstitutionDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaSubstitutionQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaSubstitutionDetailDto> Handle(GetSilaSubstitutionQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching substitution proposal. ProposalId: {request.ProposalId}, OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            RecipeSubstitutionProposal proposal = await SilaSubstitutionRules.GetProposalAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.ProposalId, cancellationToken);
            Recipe? recipe = await _repository.Recipe
                .FindByCondition(x => x.Id == proposal.RecipeId && x.BuyerId == buyer.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (recipe == null)
            {
                _logger.LogError($"Recipe of the proposal not found. ProposalId: {proposal.Id}, RecipeId: {proposal.RecipeId}");
                throw new NotFoundCustomException("Recipe not found.", "The recipe of this suggestion was removed. Dismiss the suggestion.");
            }

            SilaSubstitutionListItemDto header = (await SilaSubstitutionRules.ToListItemsAsync(
                _repository, buyer.Id, new List<RecipeSubstitutionProposal> { proposal }, cancellationToken)).First();
            SilaSubstitutionContext context = await SilaSubstitutionContext.LoadAsync(_repository, buyer.Id, new List<Recipe> { recipe }, cancellationToken);
            InventoryLocation? outlet = context.LocationOf(proposal.LocationId);
            Guid? propertyId = outlet?.PropertyId;
            decimal totalCost = context.ActiveCostOf(recipe.Id);

            SilaSubstitutionDetailDto result = new SilaSubstitutionDetailDto
            {
                Proposal = header,
                RecipeId = recipe.Id,
                RecipeCode = recipe.RecipeCode,
                RecipeName = recipe.Name,
                ItemMode = recipe.ItemMode,
                RecipeStatus = recipe.Status,
                ActiveVersion = recipe.ActiveVersion,
                LatestVersion = recipe.Version,
                HasPendingVersion = recipe.ActiveVersion > 0
                    && (recipe.Status == Common.SILA_RECIPE_PENDING_APPROVAL || recipe.Status == Common.SILA_RECIPE_DRAFT),
                Currency = recipe.Currency,
                TotalCost = totalCost,
                PropertyId = propertyId,
                PropertyName = header.PropertyName,
                Ingredients = context.IngredientViews(recipe.Id, propertyId),
                Outlets = context.OutletViews(recipe.Id, totalCost, recipe.Currency)
            };

            // Suggestions only matter while the proposal is open.
            if (proposal.Status == Common.SILA_PROPOSAL_PROPOSED && propertyId != null && recipe.ActiveVersion > 0)
            {
                result.Suggestions = context.SuggestionViews(recipe.Id, propertyId.Value, recipe.Currency);
            }

            _logger.LogInfo($"Substitution proposal fetched. ProposalId: {proposal.Id}, Ingredients: {result.Ingredients.Count}, Suggestions: {result.Suggestions.Count}");
            return result;
        }
    }
}
