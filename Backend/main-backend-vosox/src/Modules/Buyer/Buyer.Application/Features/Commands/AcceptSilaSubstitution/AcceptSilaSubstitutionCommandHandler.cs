using Buyer.Application.Features.Commands.SubmitSilaRecipe;
using Buyer.Application.Features.Commands.UpdateSilaRecipe;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.AcceptSilaSubstitution
{
    /// <summary>
    /// "Review and submit" of a recipe change suggestion: writes the approved version with the chosen substitutes as the
    /// next DRAFT version (quantity and unit copied from the replaced ingredients, costs recomputed) through the recipe
    /// edit use case, sends it for approval through the recipe submit use case, and closes the proposal (and the other open
    /// proposals of the same recipe and property that the replacements answer) as ACCEPTED with the version created.
    /// The active version keeps selling until the new one is approved.
    /// </summary>
    public class AcceptSilaSubstitutionCommandHandler : IRequestHandler<AcceptSilaSubstitutionCommand, SilaSubstitutionAcceptResultDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;

        public AcceptSilaSubstitutionCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
        }

        public Task<SilaSubstitutionAcceptResultDto> Handle(AcceptSilaSubstitutionCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(AcceptSilaSubstitutionCommand), () => SilaTransaction.RunAsync(() => HandleOnceAsync(request, cancellationToken)));
        }

        private async Task<SilaSubstitutionAcceptResultDto> HandleOnceAsync(AcceptSilaSubstitutionCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Accepting substitution proposal. ProposalId: {request.ProposalId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            RecipeSubstitutionProposal proposal = await SilaSubstitutionRules.GetProposalAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.ProposalId, cancellationToken);
            SilaSubstitutionRules.EnsureOpen(_logger, proposal);
            Recipe recipe = await SilaRecipeRules.GetTrackedAsync(_repository, _logger, buyer.Id, proposal.RecipeId);
            EnsureRecipeCanChange(recipe);

            SilaSubstitutionContext context = await SilaSubstitutionContext.LoadAsync(_repository, buyer.Id, new List<Recipe> { recipe }, cancellationToken);
            InventoryLocation? outlet = context.LocationOf(proposal.LocationId);
            if (outlet == null)
            {
                _logger.LogError($"Proposal outlet is not active. ProposalId: {proposal.Id}, LocationId: {proposal.LocationId}");
                throw new BadRequestCustomException("The outlet of this suggestion is no longer active.", "Dismiss the suggestion; the next check proposes again where needed.");
            }

            Dictionary<Guid, SilaSubstitutionCandidate> chosen = SilaSubstitutionDraft.ResolveReplacements(
                _logger, context, recipe, proposal, outlet.PropertyId, request.Request?.Replacements);
            await SilaSubstitutionDraft.EnsureSubmittableAsync(_repository, _logger, buyer.Id, recipe, chosen, cancellationToken);
            SilaRecipeWriteDto draft = SilaSubstitutionDraft.BuildWriteRequest(context, recipe, chosen);

            // The recipe use cases write the new version and start its approval (each saves).
            await _mediator.Send(new UpdateSilaRecipeCommand
            {
                OrganizationId = request.OrganizationId,
                UserId = request.UserId,
                RoleId = request.RoleId,
                RecipeId = recipe.Id,
                Request = draft
            }, cancellationToken);
            await _mediator.Send(new SubmitSilaRecipeCommand
            {
                OrganizationId = request.OrganizationId,
                UserId = request.UserId,
                RoleId = request.RoleId,
                RecipeId = recipe.Id
            }, cancellationToken);

            int closed = await CloseAnsweredAsync(context, proposal, recipe, outlet.PropertyId, chosen, request.UserId, buyer.Id, cancellationToken);
            await _repository.SaveAsync();

            _logger.LogInfo($"Substitution proposal accepted. ProposalId: {proposal.Id}, RecipeId: {recipe.Id}, Version: {recipe.Version}, Replacements: {chosen.Count}, Closed: {closed}");
            return new SilaSubstitutionAcceptResultDto
            {
                ProposalId = proposal.Id,
                RecipeId = recipe.Id,
                RecipeCode = recipe.RecipeCode,
                Version = recipe.Version,
                ProposalsClosed = closed
            };
        }

        /// <summary>Only an approved recipe without a newer version in progress can take the suggestion.</summary>
        private void EnsureRecipeCanChange(Recipe recipe)
        {
            if (recipe.Status == Common.SILA_RECIPE_INACTIVE || recipe.ActiveVersion <= 0)
            {
                _logger.LogError($"Recipe cannot take a substitution. RecipeId: {recipe.Id}, Status: {recipe.Status}, ActiveVersion: {recipe.ActiveVersion}");
                throw new BadRequestCustomException("Recipe has no approved version.", "Dismiss the suggestion; only approved recipes are changed.");
            }

            if (recipe.Status == Common.SILA_RECIPE_PENDING_APPROVAL)
            {
                _logger.LogError($"Recipe already has a version waiting for approval. RecipeId: {recipe.Id}, Version: {recipe.Version}");
                throw new ConflictCustomException(
                    $"Version {recipe.Version} of {recipe.RecipeCode} is already waiting for approval.",
                    "Wait for the approvers to decide, then review the suggestion again.");
            }

            if (recipe.Status == Common.SILA_RECIPE_DRAFT)
            {
                _logger.LogError($"Recipe already has a draft version. RecipeId: {recipe.Id}, Version: {recipe.Version}");
                throw new ConflictCustomException(
                    $"Version {recipe.Version} of {recipe.RecipeCode} is being edited.",
                    "Submit or finish the draft in Recipes first, then review the suggestion again.");
            }
        }

        /// <summary>Closes this proposal and the other open ones of the recipe in the property whose ingredient was replaced.</summary>
        private async Task<int> CloseAnsweredAsync(
            SilaSubstitutionContext context,
            RecipeSubstitutionProposal proposal,
            Recipe recipe,
            Guid propertyId,
            Dictionary<Guid, SilaSubstitutionCandidate> chosen,
            Guid userId,
            Guid buyerId,
            CancellationToken cancellationToken)
        {
            List<Guid> replacedIds = chosen.Keys.ToList();
            List<RecipeSubstitutionProposal> others = await _repository.RecipeSubstitutionProposal
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.RecipeId == recipe.Id && x.Id != proposal.Id
                    && x.Status == Common.SILA_PROPOSAL_PROPOSED && replacedIds.Contains(x.IngredientMaterialId))
                .ToListAsync(cancellationToken);
            List<RecipeSubstitutionProposal> answered = new List<RecipeSubstitutionProposal> { proposal };
            answered.AddRange(others.Where(x => context.LocationOf(x.LocationId)?.PropertyId == propertyId));

            InventoryLedger ledger = new InventoryLedger(_repository, buyerId, userId);
            foreach (RecipeSubstitutionProposal item in answered)
            {
                SilaSubstitutionCandidate substitute = chosen[item.IngredientMaterialId];
                item.CreatedVersion = recipe.Version;
                await SilaSubstitutionRules.CloseAsync(_repository, ledger, item, Common.SILA_PROPOSAL_ACCEPTED, userId,
                    SilaSubstitutionRules.EVENT_ACCEPTED,
                    $"Version {recipe.Version} of {recipe.RecipeCode} sent for approval with {substitute.Material.MaterialCode} {substitute.Quantity:0.####} {substitute.Uom}.",
                    cancellationToken);
            }

            return answered.Count;
        }
    }
}
