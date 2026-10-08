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
    /// Turns the replacements chosen in the review into the next recipe version: validates every replacement against the
    /// candidates of the property, checks up front what the submit would reject (so no orphan draft is left behind), and
    /// writes the active version with the substitutes as the recipe write request (quantity and unit copied/converted).
    /// </summary>
    public static class SilaSubstitutionDraft
    {
        private const int MAX_REPLACEMENTS = 20;
        private const int MAX_ISSUES_IN_MESSAGE = 3;

        /// <summary>The candidate chosen for each replaced ingredient material. Anything not a candidate is a 400.</summary>
        public static Dictionary<Guid, SilaSubstitutionCandidate> ResolveReplacements(
            ILoggerManager logger,
            SilaSubstitutionContext context,
            Recipe recipe,
            RecipeSubstitutionProposal proposal,
            Guid propertyId,
            List<SilaSubstitutionReplacementDto>? replacements)
        {
            List<SilaSubstitutionReplacementDto> lines = replacements ?? new List<SilaSubstitutionReplacementDto>();
            if (lines.Count == 0 || lines.Count > MAX_REPLACEMENTS)
            {
                logger.LogError($"Replacement count is invalid. ProposalId: {proposal.Id}, Count: {lines.Count}");
                throw new BadRequestCustomException("Choose a replacement.", $"Drag a suggestion onto the ingredient it replaces (1 to {MAX_REPLACEMENTS} replacements).");
            }

            if (lines.GroupBy(x => x.IngredientMaterialId).Any(x => x.Count() > 1) || lines.GroupBy(x => x.SubstituteMaterialId).Any(x => x.Count() > 1))
            {
                logger.LogError($"Replacement repeated. ProposalId: {proposal.Id}");
                throw new BadRequestCustomException("Replacement is repeated.", "Replace each ingredient once, with a different material each time.");
            }

            if (!lines.Any(x => x.IngredientMaterialId == proposal.IngredientMaterialId))
            {
                logger.LogError($"Short ingredient not replaced. ProposalId: {proposal.Id}, MaterialId: {proposal.IngredientMaterialId}");
                throw new BadRequestCustomException("The short ingredient is not replaced.", "Drag a suggestion onto the highlighted ingredient, or dismiss the suggestion.");
            }

            List<RecipeIngredient> ingredients = context.IngredientsOf(recipe.Id);
            Dictionary<Guid, SilaSubstitutionCandidate> chosen = new Dictionary<Guid, SilaSubstitutionCandidate>();
            foreach (SilaSubstitutionReplacementDto line in lines)
            {
                RecipeIngredient? ingredient = ingredients.FirstOrDefault(x => x.MaterialId == line.IngredientMaterialId);
                if (ingredient == null)
                {
                    logger.LogError($"Not an ingredient of the active version. RecipeId: {recipe.Id}, MaterialId: {line.IngredientMaterialId}");
                    throw new BadRequestCustomException("Ingredient not found.", $"Replace an ingredient of the approved version {recipe.ActiveVersion} of {recipe.RecipeCode}.");
                }

                SilaSubstitutionCandidate? candidate = context.Candidates(recipe.Id, ingredient, propertyId)
                    .FirstOrDefault(x => x.Material.Id == line.SubstituteMaterialId);
                if (candidate == null)
                {
                    logger.LogError($"Substitute is not a candidate. RecipeId: {recipe.Id}, MaterialId: {line.IngredientMaterialId}, SubstituteId: {line.SubstituteMaterialId}");
                    throw new BadRequestCustomException(
                        "Substitute cannot be used.",
                        $"Choose a priced material of the same group as {ingredient.ItemName} that is in stock in this property and converts to {ingredient.Uom}.");
                }

                chosen[line.IngredientMaterialId] = candidate;
            }

            return chosen;
        }

        /// <summary>Rejects up front what the submit would reject: a pending price change, other lines not ready, no RECIPE flow.</summary>
        public static async Task EnsureSubmittableAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            Recipe recipe,
            Dictionary<Guid, SilaSubstitutionCandidate> chosen,
            CancellationToken cancellationToken)
        {
            List<Guid> substituteIds = chosen.Values.Select(x => x.Material.Id).ToList();
            List<Guid> pending = await repository.MaterialPriceChange
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == Common.SILA_PRICE_PENDING_APPROVAL && substituteIds.Contains(x.MaterialId))
                .Select(x => x.MaterialId)
                .Distinct()
                .ToListAsync(cancellationToken);
            List<string> issues = chosen.Values
                .Where(x => pending.Contains(x.Material.Id))
                .Select(x => $"{x.Material.MaterialCode} {x.Material.Description}: Material price pending approval")
                .ToList();

            SilaRecipeReadiness readiness = await SilaRecipeReadiness.LoadAsync(repository, buyerId, new List<Guid> { recipe.Id }, cancellationToken);
            foreach (RecipeIngredient ingredient in readiness.IngredientsOf(recipe.Id, recipe.ActiveVersion))
            {
                if (ingredient.MaterialId != null && chosen.ContainsKey(ingredient.MaterialId.Value))
                {
                    continue;
                }

                string? issue = readiness.LineIssue(ingredient);
                if (issue != null)
                {
                    issues.Add($"{ingredient.ItemCode} {ingredient.ItemName}: {issue}");
                }
            }

            if (issues.Count > 0)
            {
                logger.LogError($"Substituted recipe would not be ready. RecipeId: {recipe.Id}, Issues: {issues.Count}");
                string shown = string.Join("; ", issues.Take(MAX_ISSUES_IN_MESSAGE));
                string more = issues.Count > MAX_ISSUES_IN_MESSAGE ? $" (+{issues.Count - MAX_ISSUES_IN_MESSAGE} more)" : string.Empty;
                throw new BadRequestCustomException("Recipe cannot be sent for approval yet.", $"Fix: {shown}{more}.");
            }

            ApprovalScope scope = await SilaRecipeRules.GetApprovalScopeAsync(repository, recipe, cancellationToken);
            await SilaApprovals.ResolveFlowAsync(repository, logger, buyerId, Common.SILA_APPROVAL_TYPE_RECIPE, scope, cancellationToken);
        }

        /// <summary>The active version as a write request, with the chosen substitutes in place of the replaced ingredients.</summary>
        public static SilaRecipeWriteDto BuildWriteRequest(SilaSubstitutionContext context, Recipe recipe, Dictionary<Guid, SilaSubstitutionCandidate> chosen)
        {
            List<SilaRecipeIngredientWriteDto> ingredients = context.IngredientsOf(recipe.Id).Select(x =>
            {
                if (x.MaterialId != null && chosen.TryGetValue(x.MaterialId.Value, out SilaSubstitutionCandidate? substitute))
                {
                    return new SilaRecipeIngredientWriteDto { MaterialId = substitute.Material.Id, Quantity = substitute.Quantity, Uom = substitute.Uom };
                }

                return new SilaRecipeIngredientWriteDto { MaterialId = x.MaterialId, SubRecipeId = x.SubRecipeId, Quantity = x.Quantity, Uom = x.Uom };
            }).ToList();
            List<SilaRecipeOutletPriceWriteDto> prices = context.PricesOf(recipe.Id)
                .Where(x => context.LocationOf(x.OutletLocationId) != null)
                .Select(x => new SilaRecipeOutletPriceWriteDto { OutletLocationId = x.OutletLocationId, MenuPrice = x.MenuPrice, Currency = x.Currency })
                .ToList();

            return new SilaRecipeWriteDto
            {
                Name = recipe.Name,
                Description = recipe.Description,
                Category = recipe.Category,
                FamilyId = recipe.FamilyId,
                CategoryId = recipe.CategoryId,
                ItemMode = recipe.ItemMode,
                ServingQty = recipe.ServingQty,
                ServingUom = recipe.ServingUom,
                SellingUom = recipe.SellingUom,
                PosCode = recipe.PosCode,
                Currency = recipe.Currency,
                Ingredients = ingredients,
                OutletPrices = prices
            };
        }
    }
}
