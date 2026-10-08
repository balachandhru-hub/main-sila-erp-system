using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The system side of recipe substitution (the bartender never decides): for every approved recipe of a buyer, for each
    /// property it sells in, an ingredient that is short across the property's stores and outlets gets one open proposal
    /// with the best in-stock substitute, and the outlet is alerted. Open proposals whose ingredient is back in stock (or no
    /// longer in the approved version) are dismissed automatically. A proposal dismissed by a user is not raised again for
    /// a week. The caller saves.
    /// </summary>
    public static class SilaSubstitutionEngine
    {
        private const string ALERT_SUBSTITUTE_SUGGESTED = "SUBSTITUTE_SUGGESTED";
        private const string ACTION_REVIEW_SUBSTITUTION = "REVIEW_SUBSTITUTION";
        private const int DISMISS_QUIET_DAYS = 7;

        public static async Task<SilaSubstitutionRunResultDto> RunAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid userId, CancellationToken cancellationToken)
        {
            List<Recipe> recipes = await repository.Recipe
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.ActiveVersion > 0 && x.Status == Common.SILA_RECIPE_APPROVED)
                .ToListAsync(cancellationToken);
            List<RecipeSubstitutionProposal> open = await repository.RecipeSubstitutionProposal
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == Common.SILA_PROPOSAL_PROPOSED)
                .ToListAsync(cancellationToken);
            DateTime quietFrom = DateTime.UtcNow.AddDays(-DISMISS_QUIET_DAYS);
            HashSet<(Guid RecipeId, Guid MaterialId, Guid? LocationId)> quiet = (await repository.RecipeSubstitutionProposal
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == Common.SILA_PROPOSAL_DISMISSED
                        && x.DecidedBy != null && x.DecidedOn >= quietFrom)
                    .Select(x => new { x.RecipeId, x.IngredientMaterialId, x.LocationId })
                    .ToListAsync(cancellationToken))
                .Select(x => (x.RecipeId, x.IngredientMaterialId, x.LocationId))
                .ToHashSet();

            SilaSubstitutionContext context = await SilaSubstitutionContext.LoadAsync(repository, buyerId, recipes, cancellationToken);
            List<Guid> openLocationIds = open.Where(x => x.LocationId != null).Select(x => x.LocationId!.Value).Distinct().ToList();
            Dictionary<Guid, Guid> propertyOfLocation = await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && openLocationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.PropertyId, cancellationToken);
            Dictionary<(Guid RecipeId, Guid MaterialId, Guid PropertyId), RecipeSubstitutionProposal> openByKey = open
                .Where(x => x.LocationId != null && propertyOfLocation.ContainsKey(x.LocationId.Value))
                .GroupBy(x => (x.RecipeId, x.IngredientMaterialId, propertyOfLocation[x.LocationId!.Value]))
                .ToDictionary(x => x.Key, x => x.First());
            Dictionary<Guid, string> propertyNames = await repository.BuyerProperty
                .FindByCondition(x => x.BuyerId == buyerId)
                .ToDictionaryAsync(x => x.Id, x => x.PropertyName, cancellationToken);

            InventoryLedger ledger = new InventoryLedger(repository, buyerId, userId);
            SilaSubstitutionRunResultDto result = new SilaSubstitutionRunResultDto { Buyers = 1, RecipesChecked = recipes.Count };
            HashSet<Guid> handled = new HashSet<Guid>();
            HashSet<(Guid RecipeId, Guid MaterialId, Guid PropertyId)> created = new HashSet<(Guid RecipeId, Guid MaterialId, Guid PropertyId)>();

            foreach (Recipe recipe in recipes)
            {
                foreach (InventoryLocation outlet in context.FirstOutletPerProperty(recipe.Id))
                {
                    string? propertyName = propertyNames.TryGetValue(outlet.PropertyId, out string? name) ? name : null;
                    foreach (RecipeIngredient ingredient in context.IngredientsOf(recipe.Id).Where(x => x.MaterialId != null))
                    {
                        ItemBuyerMaster? material = context.MaterialOf(ingredient.MaterialId);
                        if (material == null)
                        {
                            continue;
                        }

                        if (created.Contains((recipe.Id, material.Id, outlet.PropertyId)))
                        {
                            continue;
                        }

                        openByKey.TryGetValue((recipe.Id, material.Id, outlet.PropertyId), out RecipeSubstitutionProposal? existing);
                        if (existing != null && existing.Status != Common.SILA_PROPOSAL_PROPOSED)
                        {
                            continue;
                        }

                        if (existing != null)
                        {
                            handled.Add(existing.Id);
                        }

                        if (!context.IsShort(outlet.PropertyId, material.Id))
                        {
                            if (existing != null)
                            {
                                await SilaSubstitutionRules.CloseAsync(repository, ledger, existing, Common.SILA_PROPOSAL_DISMISSED, null,
                                    SilaSubstitutionRules.EVENT_AUTO_DISMISSED, $"{material.Description} is back in stock.", cancellationToken);
                                result.AutoDismissed++;
                            }

                            continue;
                        }

                        result.ShortIngredients++;
                        SilaSubstitutionCandidate? best = context.Candidates(recipe.Id, ingredient, outlet.PropertyId).FirstOrDefault();
                        if (best == null)
                        {
                            continue;
                        }

                        string reason = context.ShortReason(outlet.PropertyId, material, propertyName);
                        if (existing != null)
                        {
                            if (existing.SuggestedMaterialId != best.Material.Id || existing.Reason != reason)
                            {
                                result.Updated += existing.SuggestedMaterialId != best.Material.Id ? 1 : 0;
                                existing.SuggestedMaterialId = best.Material.Id;
                                existing.Reason = reason;
                                repository.RecipeSubstitutionProposal.Update(existing);
                            }

                            continue;
                        }

                        if (quiet.Contains((recipe.Id, material.Id, outlet.Id)))
                        {
                            continue;
                        }

                        RecipeSubstitutionProposal proposal = new RecipeSubstitutionProposal
                        {
                            Id = Guid.NewGuid(),
                            BuyerId = buyerId,
                            ProposalNumber = await SilaSubstitutionRules.NextNumberAsync(repository, buyerId, cancellationToken),
                            RecipeId = recipe.Id,
                            IngredientMaterialId = material.Id,
                            SuggestedMaterialId = best.Material.Id,
                            LocationId = outlet.Id,
                            Reason = reason,
                            Status = Common.SILA_PROPOSAL_PROPOSED,
                            IsActive = true
                        };
                        repository.RecipeSubstitutionProposal.Create(proposal);
                        created.Add((recipe.Id, material.Id, outlet.PropertyId));
                        handled.Add(proposal.Id);
                        result.Created++;
                        ledger.AddEvent(Common.SILA_REF_SUBSTITUTION, proposal.Id, SilaSubstitutionRules.EVENT_PROPOSED,
                            $"{recipe.RecipeCode}: replace {material.MaterialCode} with {best.Material.MaterialCode}.");
                        await ledger.RaiseAlertAsync(new InventoryAlert
                        {
                            AlertType = ALERT_SUBSTITUTE_SUGGESTED,
                            Severity = Common.SILA_SEVERITY_MEDIUM,
                            Title = $"Recipe change suggested: {recipe.Name}",
                            Message = $"{reason} Suggested substitute: {best.Material.Description} ({best.Available:0.####} {UomConverter.BaseUomOf(best.Material)} in stock). Review the suggestion and send the recipe for approval.",
                            LocationId = outlet.Id,
                            MaterialId = material.Id,
                            ReferenceType = Common.SILA_REF_SUBSTITUTION,
                            ReferenceId = proposal.Id,
                            RecommendedAction = ACTION_REVIEW_SUBSTITUTION
                        }, cancellationToken);
                    }
                }
            }

            result.AutoDismissed += await DismissStaleAsync(repository, ledger, open, handled, recipes, cancellationToken);
            logger.LogInfo($"Substitution check done. BuyerId: {buyerId}, Recipes: {result.RecipesChecked}, Short: {result.ShortIngredients}, Created: {result.Created}, Updated: {result.Updated}, AutoDismissed: {result.AutoDismissed}");
            return result;
        }

        /// <summary>
        /// Open proposals not checked above: the recipe is inactive, or its approved version no longer uses the ingredient in
        /// that property. A recipe with a newer version waiting for approval keeps its proposals open.
        /// </summary>
        private static async Task<int> DismissStaleAsync(
            IRepositoryWrapper repository,
            InventoryLedger ledger,
            List<RecipeSubstitutionProposal> open,
            HashSet<Guid> handled,
            List<Recipe> eligible,
            CancellationToken cancellationToken)
        {
            List<RecipeSubstitutionProposal> rest = open.Where(x => !handled.Contains(x.Id)).ToList();
            if (rest.Count == 0)
            {
                return 0;
            }

            HashSet<Guid> eligibleIds = eligible.Select(x => x.Id).ToHashSet();
            List<Guid> otherIds = rest.Select(x => x.RecipeId).Where(x => !eligibleIds.Contains(x)).Distinct().ToList();
            HashSet<Guid> waiting = (await repository.Recipe
                    .FindByCondition(x => otherIds.Contains(x.Id) && x.IsActive && x.ActiveVersion > 0
                        && (x.Status == Common.SILA_RECIPE_DRAFT || x.Status == Common.SILA_RECIPE_PENDING_APPROVAL || x.Status == Common.SILA_RECIPE_REJECTED))
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken))
                .ToHashSet();

            int dismissed = 0;
            foreach (RecipeSubstitutionProposal proposal in rest.Where(x => !waiting.Contains(x.RecipeId)))
            {
                string comment = eligibleIds.Contains(proposal.RecipeId)
                    ? "The approved recipe version no longer uses this ingredient here."
                    : "The recipe is no longer active.";
                await SilaSubstitutionRules.CloseAsync(repository, ledger, proposal, Common.SILA_PROPOSAL_DISMISSED, null,
                    SilaSubstitutionRules.EVENT_AUTO_DISMISSED, comment, cancellationToken);
                dismissed++;
            }

            return dismissed;
        }
    }
}
