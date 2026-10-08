using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ImportSilaPosItemMappings
{
    /// <summary>
    /// Item mapping import (template columns PosItemCode, PosItemDescription, RecipeCode). The preview validates every row and
    /// counts new / changed / unchanged mappings; the confirm call imports all rows or, while any row is invalid, none.
    /// </summary>
    public class ImportSilaPosItemMappingsCommandHandler : IRequestHandler<ImportSilaPosItemMappingsCommand, SilaPosMappingImportDto>
    {
        private const int MAX_ROWS = 5000;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ImportSilaPosItemMappingsCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaPosMappingImportDto> Handle(ImportSilaPosItemMappingsCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Importing POS item mappings. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, SourceId: {request.SourceId}, FileName: {request.FileName}, Confirm: {request.Confirm}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSource source = await SilaPosSources.GetSourceAsync(_repository, _logger, buyer.Id, request.SourceId);
            List<List<string>> table = SilaPosFiles.ReadTable(request.Content, request.FileName, _logger, false);
            if (table.Count < 2 || table.Count - 1 > MAX_ROWS)
            {
                _logger.LogError($"POS item mapping file has a wrong number of rows. Rows: {table.Count - 1}");
                throw new BadRequestCustomException("The file has no rows or too many rows.", $"Put 1 to {MAX_ROWS} mappings below the header row of the template.");
            }

            Dictionary<string, int> columns = SilaPosFiles.HeaderMap(table[0]);
            if (!columns.ContainsKey("POSITEMCODE") || !columns.ContainsKey("RECIPECODE"))
            {
                _logger.LogError("POS item mapping file misses columns.");
                throw new BadRequestCustomException("Columns are missing.", "Use the template: the first row must name PosItemCode, PosItemDescription and RecipeCode.");
            }

            List<Recipe> recipes = await _repository.Recipe
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Status != Common.SILA_RECIPE_INACTIVE)
                .ToListAsync(cancellationToken);
            Dictionary<string, Recipe> recipeByCode = recipes
                .GroupBy(x => x.RecipeCode.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);
            List<PosItemMapping> existing = await _repository.PosItemMapping
                .FindByCondition(x => x.PosSourceId == source.Id)
                .ToListAsync(cancellationToken);
            Dictionary<string, PosItemMapping> existingByCode = existing
                .GroupBy(x => x.PosItemCode.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

            SilaPosMappingImportDto result = new SilaPosMappingImportDto { FileName = Path.GetFileName(request.FileName) };
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            List<(string Code, string? Description, Recipe Recipe, PosItemMapping? Existing)> valid = new();
            for (int index = 1; index < table.Count; index++)
            {
                List<string> cells = table[index];
                if (cells.All(string.IsNullOrWhiteSpace))
                {
                    continue;
                }

                result.TotalRows++;
                List<string> problems = new List<string>();
                string? codeProblem = SilaPosSources.CheckCode(SilaPosFiles.Cell(cells, columns, "POSITEMCODE"), "PosItemCode", out string code);
                string? nameProblem = SilaPosSources.CheckName(SilaPosFiles.Cell(cells, columns, "POSITEMDESCRIPTION"), "PosItemDescription", out string? description);
                string recipeCode = (SilaPosFiles.Cell(cells, columns, "RECIPECODE") ?? string.Empty).Trim();
                if (codeProblem != null) problems.Add(codeProblem);
                if (nameProblem != null) problems.Add(nameProblem);
                if (codeProblem == null && !seen.Add(code)) problems.Add($"PosItemCode {code} appears more than once in the file");
                Recipe? recipe = null;
                if (recipeCode.Length == 0)
                {
                    problems.Add("RecipeCode is required");
                }
                else if (!recipeByCode.TryGetValue(recipeCode, out recipe))
                {
                    problems.Add($"RecipeCode {recipeCode} is not an active recipe");
                }

                if (problems.Count > 0 || recipe == null)
                {
                    result.InvalidRows++;
                    if (result.Errors.Count < SilaPosRows.MAX_ROW_ERRORS)
                    {
                        result.Errors.Add(new SilaPosRowErrorDto { Row = index + 1, Message = string.Join("; ", problems) + "." });
                    }

                    continue;
                }

                PosItemMapping? current = existingByCode.TryGetValue(code, out PosItemMapping? found) ? found : null;
                if (current == null || !current.IsActive)
                {
                    result.NewRows++;
                }
                else if (current.RecipeId != recipe.Id || (current.PosItemDescription ?? string.Empty) != (description ?? string.Empty))
                {
                    result.ChangedRows++;
                }
                else
                {
                    result.UnchangedRows++;
                }

                valid.Add((code, description, recipe, current));
            }

            if (!request.Confirm)
            {
                _logger.LogInfo($"POS item mappings previewed. Rows: {result.TotalRows}, New: {result.NewRows}, Changed: {result.ChangedRows}, Invalid: {result.InvalidRows}");
                return result;
            }

            if (result.InvalidRows > 0)
            {
                _logger.LogError($"POS item mapping import has invalid rows. Invalid: {result.InvalidRows}");
                throw new BadRequestCustomException("The file has invalid rows; nothing was imported.", $"Correct the {result.InvalidRows} invalid row(s) shown in the preview and upload the file again.");
            }

            foreach ((string code, string? description, Recipe recipe, PosItemMapping? current) in valid)
            {
                if (current == null)
                {
                    _repository.PosItemMapping.Create(new PosItemMapping
                    {
                        Id = Guid.NewGuid(),
                        PosSourceId = source.Id,
                        PosItemCode = code,
                        PosItemDescription = description,
                        RecipeId = recipe.Id,
                        IsActive = true
                    });
                    continue;
                }

                current.PosItemCode = code;
                current.PosItemDescription = description;
                current.RecipeId = recipe.Id;
                current.IsActive = true;
                _repository.PosItemMapping.Update(current);
            }

            await _repository.SaveAsync();
            result.Imported = true;
            _logger.LogInfo($"POS item mappings imported. SourceId: {source.Id}, New: {result.NewRows}, Changed: {result.ChangedRows}, Unchanged: {result.UnchangedRows}");
            return result;
        }
    }
}
