using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaRecipeApprovals
{
    /// <summary>
    /// Recipes whose current approval level (approval engine) is the signed-in user, oldest submission first, with the
    /// current level, the number of levels, the approver of the level (name and role) and the event: CREATE for a recipe
    /// never approved, CHANGE for a new version of an approved recipe.
    /// </summary>
    public class GetSilaRecipeApprovalsQueryHandler : IRequestHandler<GetSilaRecipeApprovalsQuery, List<SilaRecipeListItemDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaRecipeApprovalsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaRecipeListItemDto>> Handle(GetSilaRecipeApprovalsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching recipes pending my approval. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> recipeIds = await SilaApprovals.PendingForUserAsync(_repository, buyer.Id, Common.SILA_REF_RECIPE, request.UserId, cancellationToken);
            List<Recipe> pending = recipeIds.Count == 0
                ? new List<Recipe>()
                : await _repository.Recipe
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Status == Common.SILA_RECIPE_PENDING_APPROVAL && recipeIds.Contains(x.Id))
                    .OrderBy(x => x.SubmittedOn)
                    .Skip(SilaInputRules.Index(request.Index))
                    .Take(SilaInputRules.Limit(request.Limit))
                    .ToListAsync(cancellationToken);
            List<SilaRecipeListItemDto> result = await SilaRecipeRules.ToListItemsAsync(_repository, buyer.Id, pending, cancellationToken);
            await AddApprovalLevelsAsync(pending, result, cancellationToken);

            _logger.LogInfo($"Recipes pending my approval fetched. Count: {result.Count}");
            return result;
        }

        /// <summary>Current level, level count, approver and event of each row, in one step query and one user lookup.</summary>
        private async Task AddApprovalLevelsAsync(List<Recipe> recipes, List<SilaRecipeListItemDto> rows, CancellationToken cancellationToken)
        {
            if (recipes.Count == 0)
            {
                return;
            }

            List<Guid> ids = recipes.Select(x => x.Id).ToList();
            List<SilaApprovalStep> steps = await _repository.SilaApprovalStep
                .FindByCondition(x => x.ReferenceType == Common.SILA_REF_RECIPE && ids.Contains(x.ReferenceId) && x.IsActive)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, Recipe> byId = recipes.ToDictionary(x => x.Id);
            List<SilaApprovalStep> current = rows
                .Select(row => steps
                    .Where(x => x.ReferenceId == row.Id && x.Version == byId[row.Id].Version && x.Status == Common.SILA_APPROVAL_PENDING)
                    .OrderBy(x => x.Order)
                    .FirstOrDefault())
                .Where(x => x != null)
                .Select(x => x!)
                .ToList();
            List<Guid> userIds = current.Select(x => x.UserId).Distinct().ToList();
            List<IdentityUserDto> users = userIds.Count == 0 ? new List<IdentityUserDto>() : await _identityApiClient.GetUsersByIds(userIds, cancellationToken);

            foreach (SilaRecipeListItemDto row in rows)
            {
                Recipe recipe = byId[row.Id];
                SilaApprovalStep? step = current.FirstOrDefault(x => x.ReferenceId == row.Id);
                IdentityUserDto? approver = step == null ? null : users.FirstOrDefault(x => x.UserId == step.UserId);
                row.ApprovalEvent = recipe.ActiveVersion > 0 ? SilaRecipeRules.APPROVAL_EVENT_CHANGE : SilaRecipeRules.APPROVAL_EVENT_CREATE;
                row.ApprovalLevel = step?.Order;
                row.ApprovalLevelCount = steps.Count(x => x.ReferenceId == row.Id && x.Version == recipe.Version);
                row.ApproverName = approver?.Name;
                row.ApproverRole = approver?.RoleName;
            }
        }
    }
}
