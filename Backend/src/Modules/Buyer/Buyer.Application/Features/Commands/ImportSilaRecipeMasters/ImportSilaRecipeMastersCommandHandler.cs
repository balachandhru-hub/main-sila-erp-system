using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ImportSilaRecipeMasters
{
    /// <summary>
    /// Family / category import: one row per record (Code, Name, Description), matched by code. A known code is updated
    /// when its name or description differs, an unknown code is created (a deleted code is restored). The preview counts
    /// valid, invalid, new, changed and unchanged rows; the import saves only when there is no invalid row.
    /// </summary>
    public class ImportSilaRecipeMastersCommandHandler : IRequestHandler<ImportSilaRecipeMastersCommand, SilaRecipeImportPreviewDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ImportSilaRecipeMastersCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaRecipeImportPreviewDto> Handle(ImportSilaRecipeMastersCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Importing recipe masters. Kind: {request.Kind}, Commit: {request.Commit}, FileName: {request.FileName}, Bytes: {request.Content.Length}");

            string kind = SilaRecipeMasterRules.ParseKind(_logger, request.Kind);
            SilaRecipeExcel.EnsureWorkbook(_logger, request.FileName, request.Content);
            List<Dictionary<string, string>> rows = SilaRecipeExcel.ReadSheet(_logger, request.FileName, request.Content, null, new[] { "Code", "Name" });
            if (rows.Count == 0)
            {
                _logger.LogError($"Recipe master workbook has no rows. FileName: {request.FileName}");
                throw new BadRequestCustomException("The file has no rows.", "Keep the column names in the first row and add one record per row below it.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<(SilaRecipeMasterDto Record, bool IsActive)> existing = await SilaRecipeMasterRules.LoadAllAsync(_repository, buyer.Id, kind, cancellationToken);
            Dictionary<string, (SilaRecipeMasterDto Record, bool IsActive)> byCode = existing
                .GroupBy(x => x.Record.Code, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

            SilaRecipeImportPreviewDto result = new SilaRecipeImportPreviewDto { FileName = Path.GetFileName(request.FileName), TotalRows = rows.Count };
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            List<(SilaRecipeMasterWriteDto Record, Guid? Id)> writes = new List<(SilaRecipeMasterWriteDto Record, Guid? Id)>();
            string sheetName = kind == SilaRecipeMasterRules.KIND_FAMILIES ? "Families" : "Categories";
            foreach (Dictionary<string, string> row in rows)
            {
                SilaRecipeMasterWriteDto record = SilaRecipeMasterRules.Normalize(new SilaRecipeMasterWriteDto
                {
                    Code = SilaRecipeExcel.Value(row, "Code") ?? string.Empty,
                    Name = SilaRecipeExcel.Value(row, "Name") ?? string.Empty,
                    Description = SilaRecipeExcel.Value(row, "Description")
                });
                List<string> errors = SilaRecipeMasterRules.Errors(record);
                if (record.Code.Length > 0 && !seen.Add(record.Code))
                {
                    errors.Add($"Code {record.Code} appears more than once in the file.");
                }

                if (errors.Count > 0)
                {
                    result.InvalidRows++;
                    AddError(result, sheetName, SilaRecipeExcel.RowNumber(row), string.Join(" ", errors));
                    continue;
                }

                result.ValidRows++;
                if (!byCode.TryGetValue(record.Code, out (SilaRecipeMasterDto Record, bool IsActive) known))
                {
                    result.NewCount++;
                    writes.Add((record, null));
                }
                else if (!known.IsActive)
                {
                    result.NewCount++;
                    writes.Add((record, null));
                }
                else if (known.Record.Name != record.Name || known.Record.Description != record.Description)
                {
                    result.ChangedCount++;
                    writes.Add((record, known.Record.Id));
                }
                else
                {
                    result.UnchangedCount++;
                }
            }

            if (!request.Commit)
            {
                _logger.LogInfo($"Recipe master import previewed. Kind: {kind}, Valid: {result.ValidRows}, Invalid: {result.InvalidRows}");
                return result;
            }

            if (result.InvalidRows > 0)
            {
                _logger.LogError($"Recipe master import has invalid rows. Kind: {kind}, Invalid: {result.InvalidRows}");
                throw new BadRequestCustomException("The file has invalid rows.", "Preview the file, correct the rows with errors and upload it again. Nothing was imported.");
            }

            List<(Guid Id, string Name)> renamed = await SilaRecipeMasterRules.UpsertManyAsync(
                _repository, buyer.Id, kind, writes.Select(x => x.Record).ToList(), cancellationToken);
            foreach ((Guid id, string name) in renamed)
            {
                await SilaRecipeMasterRules.RenameCategoryOnRecipesAsync(_repository, buyer.Id, id, name, cancellationToken);
            }

            await _repository.SaveAsync();
            result.Imported = true;
            _logger.LogInfo($"Recipe masters imported. Kind: {kind}, New: {result.NewCount}, Changed: {result.ChangedCount}, Unchanged: {result.UnchangedCount}");
            return result;
        }

        private static void AddError(SilaRecipeImportPreviewDto result, string sheet, int row, string message)
        {
            if (result.Errors.Count < SilaRecipeExcel.MAX_ERRORS)
            {
                result.Errors.Add(new SilaRecipeImportErrorDto { Sheet = sheet, Row = row, Message = message });
            }
        }
    }
}
