using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SaveSilaPosItemMapping
{
    /// <summary>
    /// Maps a POS item code of a source to a recipe of the buyer (one mapping per code and source). Any active recipe can be
    /// mapped; its sales are consumed once the recipe has an approved version priced for the outlet.
    /// </summary>
    public class SaveSilaPosItemMappingCommandHandler : IRequestHandler<SaveSilaPosItemMappingCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SaveSilaPosItemMappingCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(SaveSilaPosItemMappingCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Saving POS item mapping. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, SourceId: {request.SourceId}, MappingId: {request.MappingId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSource source = await SilaPosSources.GetSourceAsync(_repository, _logger, buyer.Id, request.SourceId);
            List<string> problems = new List<string>();
            string? codeProblem = SilaPosSources.CheckCode(request.Request?.PosItemCode, "POS item code", out string code);
            string? nameProblem = SilaPosSources.CheckName(request.Request?.PosItemDescription, "POS item description", out string? description);
            if (codeProblem != null) problems.Add(codeProblem);
            if (nameProblem != null) problems.Add(nameProblem);
            if (request.Request == null || request.Request.RecipeId == Guid.Empty) problems.Add("Select the recipe");
            if (problems.Count > 0)
            {
                _logger.LogError($"POS item mapping invalid. Problems: {string.Join("; ", problems)}");
                throw new BadRequestCustomException("The item mapping is not valid.", string.Join("; ", problems) + ".");
            }

            Guid recipeId = request.Request!.RecipeId;
            Recipe? recipe = await _repository.Recipe
                .FindByCondition(x => x.Id == recipeId && x.BuyerId == buyer.Id && x.IsActive && x.Status != Common.SILA_RECIPE_INACTIVE)
                .FirstOrDefaultAsync(cancellationToken);
            if (recipe == null)
            {
                _logger.LogError($"POS item mapping recipe not found. RecipeId: {recipeId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Recipe not found.", "Select an active recipe of this organization.");
            }

            bool taken = await _repository.PosItemMapping
                .FindByCondition(x => x.PosSourceId == source.Id && x.PosItemCode == code && x.Id != request.MappingId)
                .AnyAsync(cancellationToken);
            if (taken)
            {
                _logger.LogError($"POS item code already mapped. SourceId: {source.Id}, Code: {code}");
                throw new ConflictCustomException("This POS item code is already mapped.", "Edit the existing mapping of this POS item code instead.");
            }

            PosItemMapping mapping;
            if (request.MappingId == null)
            {
                mapping = new PosItemMapping { Id = Guid.NewGuid(), PosSourceId = source.Id, IsActive = true };
                _repository.PosItemMapping.Create(mapping);
            }
            else
            {
                Guid mappingId = request.MappingId.Value;
                PosItemMapping? existing = await _repository.PosItemMapping.FindFirstByConditionAsync(
                    x => x.Id == mappingId && x.PosSourceId == source.Id && x.IsActive);
                if (existing == null)
                {
                    _logger.LogError($"POS item mapping not found. MappingId: {mappingId}, SourceId: {source.Id}");
                    throw new NotFoundCustomException("Item mapping not found.", "Select an item mapping of this POS source.");
                }

                mapping = existing;
            }

            mapping.PosItemCode = code;
            mapping.PosItemDescription = description;
            mapping.RecipeId = recipe.Id;
            await _repository.SaveAsync();

            _logger.LogInfo($"POS item mapping saved. MappingId: {mapping.Id}, Code: {code}, RecipeId: {recipe.Id}");
            return mapping.Id;
        }
    }
}
