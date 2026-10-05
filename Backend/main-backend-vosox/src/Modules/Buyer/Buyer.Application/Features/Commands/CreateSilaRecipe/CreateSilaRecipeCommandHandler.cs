using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaRecipe
{
    /// <summary>Creates a recipe as DRAFT version 1 (no active version until it is approved), with the next recipe code (RI00001).</summary>
    public class CreateSilaRecipeCommandHandler : IRequestHandler<CreateSilaRecipeCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateSilaRecipeCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Guid> Handle(CreateSilaRecipeCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(CreateSilaRecipeCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Guid> HandleOnceAsync(CreateSilaRecipeCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Creating recipe. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, Name: {request.Request?.Name}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            string recipeCode = await DocumentNumber.NextAsync(_repository, buyer.Id, DocumentNumber.RECIPE, 5, cancellationToken);
            Recipe recipe = new Recipe
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                RecipeCode = recipeCode,
                Status = Common.SILA_RECIPE_DRAFT,
                Version = 1,
                ActiveVersion = 0,
                IsActive = true
            };

            await SilaRecipeRules.ApplyAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, recipe, request.Request!, cancellationToken);
            _repository.Recipe.Create(recipe);
            new InventoryLedger(_repository, buyer.Id, request.UserId).AddEvent(Common.SILA_REF_RECIPE, recipe.Id, SilaRecipeRules.EVENT_CREATED, null);
            await _repository.SaveAsync();

            _logger.LogInfo($"Recipe created. RecipeId: {recipe.Id}, RecipeCode: {recipe.RecipeCode}, TotalCost: {recipe.TotalCost}");
            return recipe.Id;
        }
    }
}
