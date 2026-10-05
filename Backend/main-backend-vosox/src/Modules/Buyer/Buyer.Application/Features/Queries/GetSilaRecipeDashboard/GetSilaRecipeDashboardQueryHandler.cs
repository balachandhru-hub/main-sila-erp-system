using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaRecipeDashboard
{
    /// <summary>
    /// Counts (active recipes, drafts, approvals waiting for me and in total, failed POS sales, consumption posted today) and
    /// a short "what to do next" list: recipes waiting for my approval, draft versions that are not ready, failed POS sales.
    /// POS figures cover the locations the user may work with.
    /// </summary>
    public class GetSilaRecipeDashboardQueryHandler : IRequestHandler<GetSilaRecipeDashboardQuery, SilaRecipeDashboardDto>
    {
        private const int ACTIONS_PER_KIND = 5;
        private const int DRAFTS_CHECKED = 50;
        public const string ACTION_AWAITING_ME = "AWAITING_ME";
        public const string ACTION_NOT_READY = "NOT_READY";
        public const string ACTION_FAILED_POS = "FAILED_POS";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaRecipeDashboardQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaRecipeDashboardDto> Handle(GetSilaRecipeDashboardQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching recipe dashboard. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            IQueryable<Recipe> recipes = _repository.Recipe.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            SilaRecipeDashboardDto result = new SilaRecipeDashboardDto
            {
                ActiveRecipes = await recipes.CountAsync(x => x.ActiveVersion > 0 && x.Status != Common.SILA_RECIPE_INACTIVE, cancellationToken),
                DraftRecipes = await recipes.CountAsync(x => x.Status == Common.SILA_RECIPE_DRAFT, cancellationToken),
                PendingApprovalTotal = await recipes.CountAsync(x => x.Status == Common.SILA_RECIPE_PENDING_APPROVAL, cancellationToken),
                TotalRecipes = await recipes.CountAsync(cancellationToken),
                MaterialCount = await _repository.ItemBuyerMaster.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive).CountAsync(cancellationToken)
            };

            List<Guid> mineIds = await SilaApprovals.PendingForUserAsync(_repository, buyer.Id, Common.SILA_REF_RECIPE, request.UserId, cancellationToken);
            List<Recipe> mine = mineIds.Count == 0
                ? new List<Recipe>()
                : await recipes.Where(x => mineIds.Contains(x.Id) && x.Status == Common.SILA_RECIPE_PENDING_APPROVAL)
                    .OrderBy(x => x.SubmittedOn)
                    .ToListAsync(cancellationToken);
            result.PendingMyApproval = mine.Count;
            result.NextActions.AddRange(mine.Take(ACTIONS_PER_KIND).Select(x => new SilaRecipeNextActionDto
            {
                Kind = ACTION_AWAITING_ME,
                Title = $"Approve {x.RecipeCode} {x.Name}",
                Detail = $"Version {x.Version} is waiting for your decision.",
                ReferenceId = x.Id
            }));

            List<Recipe> drafts = await recipes.Where(x => x.Status == Common.SILA_RECIPE_DRAFT)
                .OrderByDescending(x => x.DateUpdated)
                .Take(DRAFTS_CHECKED)
                .ToListAsync(cancellationToken);
            SilaRecipeReadiness readiness = await SilaRecipeReadiness.LoadAsync(_repository, buyer.Id, drafts.Select(x => x.Id).ToList(), cancellationToken);
            result.NextActions.AddRange(drafts
                .Select(x => (Recipe: x, Check: readiness.Evaluate(x, x.Version)))
                .Where(x => !x.Check.Ready)
                .Take(ACTIONS_PER_KIND)
                .Select(x => new SilaRecipeNextActionDto
                {
                    Kind = ACTION_NOT_READY,
                    Title = $"Complete {x.Recipe.RecipeCode} {x.Recipe.Name}",
                    Detail = $"Not ready ({x.Check.Issues.Count}): {x.Check.Issues[0]}",
                    ReferenceId = x.Recipe.Id
                }));

            await AddPosFiguresAsync(request, buyer.Id, result, cancellationToken);

            _logger.LogInfo($"Recipe dashboard fetched. Active: {result.ActiveRecipes}, Mine: {result.PendingMyApproval}, FailedPos: {result.FailedPosSales}");
            return result;
        }

        private async Task AddPosFiguresAsync(GetSilaRecipeDashboardQuery request, Guid buyerId, SilaRecipeDashboardDto result, CancellationToken cancellationToken)
        {
            bool full = SilaAccess.HasFullAccess(request.RoleId);
            List<Guid> locationIds = full
                ? new List<Guid>()
                : await SilaAccess.GetLocationIdsAsync(_repository, buyerId, request.UserId, request.RoleId, cancellationToken);

            IQueryable<PosSalesTransaction> failed = _repository.PosSalesTransaction
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == Common.SILA_POS_FAILED);
            if (!full)
            {
                failed = failed.Where(x => x.OutletLocationId != null && locationIds.Contains(x.OutletLocationId.Value));
            }

            result.FailedPosSales = await failed.CountAsync(cancellationToken);
            List<PosSalesTransaction> latestFailed = await failed.OrderByDescending(x => x.DateUpdated).Take(ACTIONS_PER_KIND).ToListAsync(cancellationToken);
            result.NextActions.AddRange(latestFailed.Select(x => new SilaRecipeNextActionDto
            {
                Kind = ACTION_FAILED_POS,
                Title = $"POS sale {x.SourceTransactionId}/{x.LineNumber} failed ({x.PosCode})",
                Detail = x.FailureMessage,
                ReferenceId = x.Id
            }));

            DateTime today = DateTime.UtcNow.Date;
            IQueryable<InventoryTransaction> consumption = _repository.InventoryTransaction
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.TransactionType == Common.SILA_TXN_RECIPE_CONSUMPTION && x.DateCreated >= today);
            if (!full)
            {
                consumption = consumption.Where(x => locationIds.Contains(x.LocationId));
            }

            result.ConsumptionPostedToday = await consumption.CountAsync(cancellationToken);
        }
    }
}
