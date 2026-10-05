using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ImportSilaPosOutletMappings
{
    /// <summary>
    /// Outlet mapping import (template columns PosOutletCode, PosOutletName, LocationCode). The preview validates every row and
    /// counts new / changed / unchanged mappings; the confirm call imports all rows or, while any row is invalid, none.
    /// </summary>
    public class ImportSilaPosOutletMappingsCommandHandler : IRequestHandler<ImportSilaPosOutletMappingsCommand, SilaPosMappingImportDto>
    {
        private const int MAX_ROWS = 5000;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ImportSilaPosOutletMappingsCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaPosMappingImportDto> Handle(ImportSilaPosOutletMappingsCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Importing POS outlet mappings. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, SourceId: {request.SourceId}, FileName: {request.FileName}, Confirm: {request.Confirm}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSource source = await SilaPosSources.GetSourceAsync(_repository, _logger, buyer.Id, request.SourceId);
            List<List<string>> table = SilaPosFiles.ReadTable(request.Content, request.FileName, _logger, false);
            if (table.Count < 2 || table.Count - 1 > MAX_ROWS)
            {
                _logger.LogError($"POS outlet mapping file has a wrong number of rows. Rows: {table.Count - 1}");
                throw new BadRequestCustomException("The file has no rows or too many rows.", $"Put 1 to {MAX_ROWS} mappings below the header row of the template.");
            }

            Dictionary<string, int> columns = SilaPosFiles.HeaderMap(table[0]);
            if (!columns.ContainsKey("POSOUTLETCODE") || !columns.ContainsKey("LOCATIONCODE"))
            {
                _logger.LogError("POS outlet mapping file misses columns.");
                throw new BadRequestCustomException("Columns are missing.", "Use the template: the first row must name PosOutletCode, PosOutletName and LocationCode.");
            }

            List<InventoryLocation> outlets = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.LocationType == Common.SILA_LOCATION_OUTLET)
                .ToListAsync(cancellationToken);
            Dictionary<string, InventoryLocation> outletByCode = outlets
                .GroupBy(x => x.LocationCode.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);
            List<PosOutletMapping> existing = await _repository.PosOutletMapping
                .FindByCondition(x => x.PosSourceId == source.Id)
                .ToListAsync(cancellationToken);
            Dictionary<string, PosOutletMapping> existingByCode = existing
                .GroupBy(x => x.PosOutletCode.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

            SilaPosMappingImportDto result = new SilaPosMappingImportDto { FileName = Path.GetFileName(request.FileName) };
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            List<(string Code, string? Name, InventoryLocation Location, PosOutletMapping? Existing)> valid = new();
            for (int index = 1; index < table.Count; index++)
            {
                List<string> cells = table[index];
                if (cells.All(string.IsNullOrWhiteSpace))
                {
                    continue;
                }

                result.TotalRows++;
                List<string> problems = new List<string>();
                string? codeProblem = SilaPosSources.CheckCode(SilaPosFiles.Cell(cells, columns, "POSOUTLETCODE"), "PosOutletCode", out string code);
                string? nameProblem = SilaPosSources.CheckName(SilaPosFiles.Cell(cells, columns, "POSOUTLETNAME"), "PosOutletName", out string? name);
                string locationCode = (SilaPosFiles.Cell(cells, columns, "LOCATIONCODE") ?? string.Empty).Trim();
                if (codeProblem != null) problems.Add(codeProblem);
                if (nameProblem != null) problems.Add(nameProblem);
                if (codeProblem == null && !seen.Add(code)) problems.Add($"PosOutletCode {code} appears more than once in the file");
                InventoryLocation? location = null;
                if (locationCode.Length == 0)
                {
                    problems.Add("LocationCode is required");
                }
                else if (!outletByCode.TryGetValue(locationCode, out location))
                {
                    problems.Add($"LocationCode {locationCode} is not an active outlet location");
                }

                if (problems.Count > 0 || location == null)
                {
                    result.InvalidRows++;
                    if (result.Errors.Count < SilaPosRows.MAX_ROW_ERRORS)
                    {
                        result.Errors.Add(new SilaPosRowErrorDto { Row = index + 1, Message = string.Join("; ", problems) + "." });
                    }

                    continue;
                }

                PosOutletMapping? current = existingByCode.TryGetValue(code, out PosOutletMapping? found) ? found : null;
                if (current == null || !current.IsActive)
                {
                    result.NewRows++;
                }
                else if (current.OutletLocationId != location.Id || (current.PosOutletName ?? string.Empty) != (name ?? string.Empty))
                {
                    result.ChangedRows++;
                }
                else
                {
                    result.UnchangedRows++;
                }

                valid.Add((code, name, location, current));
            }

            if (!request.Confirm)
            {
                _logger.LogInfo($"POS outlet mappings previewed. Rows: {result.TotalRows}, New: {result.NewRows}, Changed: {result.ChangedRows}, Invalid: {result.InvalidRows}");
                return result;
            }

            if (result.InvalidRows > 0)
            {
                _logger.LogError($"POS outlet mapping import has invalid rows. Invalid: {result.InvalidRows}");
                throw new BadRequestCustomException("The file has invalid rows; nothing was imported.", $"Correct the {result.InvalidRows} invalid row(s) shown in the preview and upload the file again.");
            }

            foreach ((string code, string? name, InventoryLocation location, PosOutletMapping? current) in valid)
            {
                if (current == null)
                {
                    _repository.PosOutletMapping.Create(new PosOutletMapping
                    {
                        Id = Guid.NewGuid(),
                        PosSourceId = source.Id,
                        PosOutletCode = code,
                        PosOutletName = name,
                        OutletLocationId = location.Id,
                        IsActive = true
                    });
                    continue;
                }

                current.PosOutletCode = code;
                current.PosOutletName = name;
                current.OutletLocationId = location.Id;
                current.IsActive = true;
                _repository.PosOutletMapping.Update(current);
            }

            await _repository.SaveAsync();
            result.Imported = true;
            _logger.LogInfo($"POS outlet mappings imported. SourceId: {source.Id}, New: {result.NewRows}, Changed: {result.ChangedRows}, Unchanged: {result.UnchangedRows}");
            return result;
        }
    }
}
