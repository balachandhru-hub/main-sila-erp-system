using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Rules shared by the recipe substitution use cases: who sees a proposal (users with a location in its property; the
    /// buyer administrator, store manager and cost controller see all), list rows, numbering and closing a proposal.
    /// </summary>
    public static class SilaSubstitutionRules
    {
        public const string EVENT_PROPOSED = "PROPOSED";
        public const string EVENT_ACCEPTED = "ACCEPTED";
        public const string EVENT_DISMISSED = "DISMISSED";
        public const string EVENT_AUTO_DISMISSED = "AUTO_DISMISSED";
        public const int MAX_REASON = 500;

        /// <summary>Location ids whose proposals the user sees (every location of a property the user works in); null = all.</summary>
        public static async Task<List<Guid>?> GetVisibleLocationIdsAsync(
            IRepositoryWrapper repository, Guid buyerId, Guid userId, Guid roleId, CancellationToken cancellationToken)
        {
            if (SilaAccess.HasFullAccess(roleId))
            {
                return null;
            }

            List<Guid> mine = await SilaAccess.GetLocationIdsAsync(repository, buyerId, userId, roleId, cancellationToken);
            if (mine.Count == 0)
            {
                return new List<Guid>();
            }

            List<Guid> propertyIds = await repository.InventoryLocation
                .FindByCondition(x => mine.Contains(x.Id))
                .Select(x => x.PropertyId)
                .Distinct()
                .ToListAsync(cancellationToken);
            return await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && propertyIds.Contains(x.PropertyId))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
        }

        /// <summary>A proposal of the buyer the user may see. Another buyer's or an invisible proposal is a 404.</summary>
        public static async Task<RecipeSubstitutionProposal> GetProposalAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid userId, Guid roleId, Guid proposalId, CancellationToken cancellationToken)
        {
            RecipeSubstitutionProposal? proposal = await repository.RecipeSubstitutionProposal.FindFirstByConditionAsync(
                x => x.Id == proposalId && x.BuyerId == buyerId && x.IsActive);
            List<Guid>? visible = proposal == null ? null : await GetVisibleLocationIdsAsync(repository, buyerId, userId, roleId, cancellationToken);
            if (proposal == null || (visible != null && (proposal.LocationId == null || !visible.Contains(proposal.LocationId.Value))))
            {
                logger.LogError($"Substitution proposal not found. ProposalId: {proposalId}, BuyerId: {buyerId}, UserId: {userId}");
                throw new NotFoundCustomException("Suggestion not found.", "Open a recipe change suggestion of a property you work in.");
            }

            return proposal;
        }

        public static void EnsureOpen(ILoggerManager logger, RecipeSubstitutionProposal proposal)
        {
            if (proposal.Status != Common.SILA_PROPOSAL_PROPOSED)
            {
                logger.LogError($"Substitution proposal already decided. ProposalId: {proposal.Id}, Status: {proposal.Status}");
                throw new ConflictCustomException(
                    $"Suggestion is already {proposal.Status.ToLowerInvariant()}.",
                    "Refresh the list; only an open suggestion can be accepted or dismissed.");
            }
        }

        public static Task<string> NextNumberAsync(IRepositoryWrapper repository, Guid buyerId, CancellationToken cancellationToken)
        {
            return DocumentNumber.NextAsync(repository, buyerId, DocumentNumber.SUBSTITUTION, 6, cancellationToken);
        }

        /// <summary>Closes the proposal (ACCEPTED or DISMISSED) and resolves the alert raised for it. The caller saves.</summary>
        public static async Task CloseAsync(
            IRepositoryWrapper repository,
            InventoryLedger ledger,
            RecipeSubstitutionProposal proposal,
            string status,
            Guid? decidedBy,
            string eventAction,
            string? comment,
            CancellationToken cancellationToken)
        {
            proposal.Status = status;
            proposal.DecidedBy = decidedBy;
            proposal.DecidedOn = DateTime.UtcNow;
            repository.RecipeSubstitutionProposal.Update(proposal);
            ledger.AddEvent(Common.SILA_REF_SUBSTITUTION, proposal.Id, eventAction, comment);

            List<InventoryAlert> alerts = await repository.InventoryAlert
                .FindByCondition(x => x.BuyerId == proposal.BuyerId && x.IsActive
                    && x.ReferenceType == Common.SILA_REF_SUBSTITUTION && x.ReferenceId == proposal.Id
                    && (x.Status == Common.SILA_ALERT_NEW || x.Status == Common.SILA_ALERT_ACKNOWLEDGED))
                .ToListAsync(cancellationToken);
            foreach (InventoryAlert alert in alerts)
            {
                alert.Status = Common.SILA_ALERT_RESOLVED;
            }

            if (alerts.Count > 0)
            {
                repository.InventoryAlert.UpdateRange(alerts);
            }
        }

        /// <summary>List rows with recipe, material, location and property names (batch lookups).</summary>
        public static async Task<List<SilaSubstitutionListItemDto>> ToListItemsAsync(
            IRepositoryWrapper repository, Guid buyerId, List<RecipeSubstitutionProposal> proposals, CancellationToken cancellationToken)
        {
            List<Guid> recipeIds = proposals.Select(x => x.RecipeId).Distinct().ToList();
            List<Guid> materialIds = proposals.Select(x => x.IngredientMaterialId).Concat(proposals.Select(x => x.SuggestedMaterialId)).Distinct().ToList();
            List<Guid> locationIds = proposals.Where(x => x.LocationId != null).Select(x => x.LocationId!.Value).Distinct().ToList();
            Dictionary<Guid, Recipe> recipes = await repository.Recipe
                .FindByCondition(x => x.BuyerId == buyerId && recipeIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, ItemBuyerMaster> materials = await repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, InventoryLocation> locations = await repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyerId && locationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            List<Guid> propertyIds = locations.Values.Select(x => x.PropertyId).Distinct().ToList();
            Dictionary<Guid, string> properties = await repository.BuyerProperty
                .FindByCondition(x => propertyIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.PropertyName, cancellationToken);

            return proposals.Select(x =>
            {
                Recipe? recipe = recipes.TryGetValue(x.RecipeId, out Recipe? r) ? r : null;
                ItemBuyerMaster? ingredient = materials.TryGetValue(x.IngredientMaterialId, out ItemBuyerMaster? i) ? i : null;
                ItemBuyerMaster? suggested = materials.TryGetValue(x.SuggestedMaterialId, out ItemBuyerMaster? s) ? s : null;
                InventoryLocation? location = x.LocationId != null && locations.TryGetValue(x.LocationId.Value, out InventoryLocation? l) ? l : null;
                return new SilaSubstitutionListItemDto
                {
                    Id = x.Id,
                    ProposalNumber = x.ProposalNumber,
                    Status = x.Status,
                    Reason = x.Reason,
                    RecipeId = x.RecipeId,
                    RecipeCode = recipe?.RecipeCode ?? string.Empty,
                    RecipeName = recipe?.Name ?? string.Empty,
                    IngredientMaterialId = x.IngredientMaterialId,
                    IngredientCode = ingredient?.MaterialCode ?? string.Empty,
                    IngredientName = ingredient?.Description ?? string.Empty,
                    SuggestedMaterialId = x.SuggestedMaterialId,
                    SuggestedCode = suggested?.MaterialCode ?? string.Empty,
                    SuggestedName = suggested?.Description ?? string.Empty,
                    LocationId = x.LocationId,
                    LocationName = location?.LocationName,
                    PropertyName = location != null && properties.TryGetValue(location.PropertyId, out string? name) ? name : null,
                    CreatedVersion = x.CreatedVersion,
                    DateCreated = x.DateCreated,
                    DecidedOn = x.DecidedOn
                };
            }).ToList();
        }
    }
}
