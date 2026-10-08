using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UpdateSilaRecipe
{
    /// <summary>
    /// Edits a recipe. A DRAFT version is edited in place; when the latest version is APPROVED or REJECTED the edit becomes
    /// a new DRAFT version (Version + 1) and the approved version keeps selling until the new one is approved. A version
    /// waiting for approval or an inactive recipe cannot be edited.
    /// </summary>
    public class UpdateSilaRecipeCommandHandler : IRequestHandler<UpdateSilaRecipeCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public UpdateSilaRecipeCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(UpdateSilaRecipeCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Updating recipe. RecipeId: {request.RecipeId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Recipe recipe = await SilaRecipeRules.GetTrackedAsync(_repository, _logger, buyer.Id, request.RecipeId);
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);

            SilaRecipeRules.StartEditing(_logger, recipe, ledger);
            await SilaRecipeRules.ApplyAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, recipe, request.Request!, cancellationToken);
            ledger.AddEvent(Common.SILA_REF_RECIPE, recipe.Id, SilaRecipeRules.EVENT_UPDATED, $"Version {recipe.Version}.");
            await _repository.SaveAsync();

            _logger.LogInfo($"Recipe updated. RecipeId: {recipe.Id}, Version: {recipe.Version}, ActiveVersion: {recipe.ActiveVersion}, TotalCost: {recipe.TotalCost}");
            return Unit.Value;
        }
    }
}
