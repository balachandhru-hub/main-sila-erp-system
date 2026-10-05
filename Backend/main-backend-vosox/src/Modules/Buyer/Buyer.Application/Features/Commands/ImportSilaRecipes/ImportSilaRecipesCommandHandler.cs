using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ImportSilaRecipes
{
    /// <summary>
    /// Recipe Excel import, preview then confirm. The confirmed import re-reads the same file, refuses it when any row is
    /// invalid, and writes every NEW and CHANGED recipe through the same rules as the recipe editor in one save.
    /// </summary>
    public class ImportSilaRecipesCommandHandler : IRequestHandler<ImportSilaRecipesCommand, SilaRecipeImportPreviewDto>
    {
        private const int MAX_RECIPES = 500;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ImportSilaRecipesCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<SilaRecipeImportPreviewDto> Handle(ImportSilaRecipesCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(ImportSilaRecipesCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<SilaRecipeImportPreviewDto> HandleOnceAsync(ImportSilaRecipesCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Importing recipes. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, Commit: {request.Commit}, FileName: {request.FileName}, Bytes: {request.Content.Length}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            (List<SilaRecipeImport.Group> groups, SilaRecipeImportPreviewDto preview) =
                await SilaRecipeImport.ReadAsync(_repository, _logger, buyer.Id, request.FileName, request.Content, cancellationToken);
            if (groups.Count == 0)
            {
                _logger.LogError($"Recipe workbook has no recipe. FileName: {request.FileName}");
                throw new BadRequestCustomException("The file has no recipes.", "Fill the Recipes sheet of the template: one row per ingredient.");
            }

            if (groups.Count > MAX_RECIPES)
            {
                _logger.LogError($"Recipe workbook has too many recipes. Recipes: {groups.Count}");
                throw new BadRequestCustomException("The file has too many recipes.", $"Import at most {MAX_RECIPES} recipes per file.");
            }

            if (!request.Commit)
            {
                _logger.LogInfo($"Recipe import previewed. Valid: {preview.ValidRows}, Invalid: {preview.InvalidRows}, New: {preview.NewCount}, Changed: {preview.ChangedCount}");
                return preview;
            }

            if (preview.InvalidRows > 0)
            {
                _logger.LogError($"Recipe import has invalid rows. Invalid: {preview.InvalidRows}");
                throw new BadRequestCustomException("The file has invalid rows.", "Preview the file, correct the rows with errors and upload it again. Nothing was imported.");
            }

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            foreach (SilaRecipeImport.Group group in groups.Where(x => x.Action != SilaRecipeImport.ACTION_UNCHANGED))
            {
                if (group.Existing == null)
                {
                    Recipe recipe = new Recipe
                    {
                        Id = Guid.NewGuid(),
                        BuyerId = buyer.Id,
                        RecipeCode = await DocumentNumber.NextAsync(_repository, buyer.Id, DocumentNumber.RECIPE, 5, cancellationToken),
                        Status = Common.SILA_RECIPE_DRAFT,
                        Version = 1,
                        ActiveVersion = 0,
                        IsActive = true
                    };
                    await SilaRecipeRules.ApplyAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, recipe, group.Request, cancellationToken);
                    _repository.Recipe.Create(recipe);
                    ledger.AddEvent(Common.SILA_REF_RECIPE, recipe.Id, SilaRecipeRules.EVENT_CREATED, $"Excel import {Path.GetFileName(request.FileName)}.");
                    continue;
                }

                Recipe tracked = await SilaRecipeRules.GetTrackedAsync(_repository, _logger, buyer.Id, group.Existing.Id);
                SilaRecipeRules.StartEditing(_logger, tracked, ledger);
                await SilaRecipeRules.ApplyAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, tracked, group.Request, cancellationToken);
                ledger.AddEvent(Common.SILA_REF_RECIPE, tracked.Id, SilaRecipeRules.EVENT_UPDATED, $"Version {tracked.Version} from Excel import {Path.GetFileName(request.FileName)}.");
            }

            await _repository.SaveAsync();
            preview.Imported = true;
            _logger.LogInfo($"Recipes imported. New: {preview.NewCount}, Changed: {preview.ChangedCount}, Unchanged: {preview.UnchangedCount}");
            return preview;
        }
    }
}
