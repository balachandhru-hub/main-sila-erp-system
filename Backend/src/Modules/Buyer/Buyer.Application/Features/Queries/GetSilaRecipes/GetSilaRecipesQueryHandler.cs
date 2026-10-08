using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaRecipes
{
    /// <summary>One page of the buyer's recipes (latest version) with readiness, filtered by status, mode, family, category or text.</summary>
    public class GetSilaRecipesQueryHandler : IRequestHandler<GetSilaRecipesQuery, SilaRecipePageDto>
    {
        private const int MAX_LIMIT = 200;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaRecipesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaRecipePageDto> Handle(GetSilaRecipesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching recipes. OrganizationId: {request.OrganizationId}, Status: {request.Status}, Search: {request.Search}, Index: {request.Index}, Limit: {request.Limit}");

            if (request.Index < 0 || request.Limit < 1 || request.Limit > MAX_LIMIT)
            {
                _logger.LogError($"Recipe paging is invalid. Index: {request.Index}, Limit: {request.Limit}");
                throw new BadRequestCustomException("Paging is invalid.", $"Use an index of 0 or more and a limit between 1 and {MAX_LIMIT}.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            IQueryable<Recipe> query = _repository.Recipe.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                string status = SilaInputRules.OneOf(_logger, request.Status, new[]
                {
                    Common.SILA_RECIPE_DRAFT, Common.SILA_RECIPE_PENDING_APPROVAL, Common.SILA_RECIPE_APPROVED,
                    Common.SILA_RECIPE_REJECTED, Common.SILA_RECIPE_INACTIVE
                }, "recipe status");
                query = query.Where(x => x.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(request.ItemMode))
            {
                string mode = SilaInputRules.OneOf(_logger, request.ItemMode, new[]
                {
                    Common.SILA_RECIPE_DIRECT, Common.SILA_RECIPE_RECIPE, Common.SILA_RECIPE_BATCH
                }, "item mode");
                query = query.Where(x => x.ItemMode == mode);
            }

            if (request.FamilyId != null)
            {
                query = query.Where(x => x.FamilyId == request.FamilyId);
            }

            if (request.CategoryId != null)
            {
                query = query.Where(x => x.CategoryId == request.CategoryId);
            }

            if (request.Active == true)
            {
                query = query.Where(x => x.ActiveVersion > 0 && x.Status != Common.SILA_RECIPE_INACTIVE);
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                query = query.Where(x => x.RecipeCode.Contains(search) || x.Name.Contains(search) || (x.PosCode != null && x.PosCode.Contains(search))
                    || (x.DraftName != null && x.DraftName.Contains(search)) || (x.DraftPosCode != null && x.DraftPosCode.Contains(search)));
            }

            int total = await query.CountAsync(cancellationToken);
            List<Recipe> recipes = await query
                .OrderBy(x => x.RecipeCode)
                .Skip(request.Index * request.Limit)
                .Take(request.Limit)
                .ToListAsync(cancellationToken);
            List<SilaRecipeListItemDto> items = await SilaRecipeRules.ToListItemsAsync(_repository, buyer.Id, recipes, cancellationToken);

            _logger.LogInfo($"Recipes fetched. Count: {items.Count}, Total: {total}");
            return new SilaRecipePageDto { Items = items, Total = total, Index = request.Index, Limit = request.Limit };
        }
    }
}
